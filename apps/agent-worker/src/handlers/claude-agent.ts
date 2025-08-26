import { upgradeWebSocket } from 'hono/cloudflare-workers'

import type { Context } from 'hono'
import type { WSContext } from 'hono/ws'
import type { App } from '../context'

/**
 * WebSocket message types
 */
interface WSMessage {
	type: 'user_message' | 'agent_response' | 'error' | 'status'
	content?: string
	model?: string
	data?: unknown
	timestamp?: number
}

/**
 * Handle WebSocket upgrade for Claude Code Agent
 */
export function handleAgentWebSocket(c: Context<App>) {
	// Extract session ID from URL path
	const sessionId = c.req.param('sessionId')
	if (!sessionId) {
		return new Response('Session ID required', { status: 400 })
	}

	return upgradeWebSocket(c, {
		onMessage: async (event, ws: WSContext) => {
			try {
				const message = JSON.parse(event.data as string) as WSMessage
				console.log(`📨 Received WebSocket message for session ${sessionId}:`, message)

				if (message.type === 'user_message' && message.content) {
					// Get session-specific agent instance
					const agentId = c.env.CLAUDE_CODE_AGENT.idFromName(`session-${sessionId}`)
					const agent = c.env.CLAUDE_CODE_AGENT.get(agentId)

					// Get initial state to track message count
					const initialState = await agent.getState()
					const initialMessageCount = initialState.messages ? initialState.messages.length : 0

					// Process message through agent with session ID and model
					await agent.processMessage(message.content, sessionId, message.model)

					// Wait for agent processing to complete by checking for new messages
					// The agent adds both user message and assistant response to state
					let attempts = 0
					const maxAttempts = 10
					let finalState = await agent.getState()

					while (attempts < maxAttempts) {
						finalState = await agent.getState()
						const currentMessageCount = finalState.messages ? finalState.messages.length : 0

						// Wait for at least 2 new messages (user + assistant)
						if (currentMessageCount >= initialMessageCount + 2) {
							break
						}

						// Wait a bit for processing to complete
						await new Promise((resolve) => setTimeout(resolve, 500))
						attempts++
					}

					// Send the latest assistant message to WebSocket client
					const messages = finalState.messages || []
					if (messages.length > 0) {
						// Get the last assistant message (not user message)
						const assistantMessage = messages
							.slice()
							.reverse()
							.find((msg) => msg.role === 'assistant')
						if (assistantMessage && assistantMessage.content) {
							ws.send(
								JSON.stringify({
									type: assistantMessage.type || 'result',
									content: assistantMessage.content,
									timestamp: assistantMessage.timestamp,
									session_id: finalState.claudeSession?.id || null, // Include session ID for client
								})
							)
						}
					}
				}
			} catch (error) {
				console.error('❌ WebSocket message processing error:', error)

				ws.send(
					JSON.stringify({
						type: 'error',
						content: `Error processing message: ${error instanceof Error ? error.message : String(error)}`,
						timestamp: Date.now(),
					} as WSMessage)
				)
			}
		},

		onClose: async (_event, _ws: WSContext) => {
			console.log('🔌 WebSocket connection closed')
		},

		onError: async (event, _ws: WSContext) => {
			console.error('❌ WebSocket error:', event)
		},
	})
}

/**
 * Handle agent REST endpoint for non-WebSocket clients
 */
export async function handleAgentMessage(c: Context<App>): Promise<Response> {
	try {
		const { message, sessionId } = await c.req.json()

		if (!message) {
			return c.json(
				{
					error: 'Missing message field',
				},
				400
			)
		}

		// Get session-specific agent instance or default
		const agentId = sessionId ? `session-${sessionId}` : 'claude-agent-default'
		const agent = c.env.CLAUDE_CODE_AGENT.get(c.env.CLAUDE_CODE_AGENT.idFromName(agentId))

		// Process message with optional session ID
		await agent.processMessage(message, sessionId)

		return c.json({
			status: 'Message processed',
			timestamp: Date.now(),
		})
	} catch (error) {
		console.error('❌ Agent message handler error:', error)
		return c.json(
			{
				error: 'Internal server error',
				details: error instanceof Error ? error.message : String(error),
			},
			500
		)
	}
}
