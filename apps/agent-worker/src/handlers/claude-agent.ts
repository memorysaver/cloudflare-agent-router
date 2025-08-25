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

					// Process message through agent with session ID and model
					await agent.processMessage(message.content, sessionId, message.model)

					// Get the latest messages from agent state
					const state = await agent.getState()
					const messages = state.messages || []

					// Send the latest messages to WebSocket client
					if (messages.length > 0) {
						const latestMessage = messages[messages.length - 1]
						if (latestMessage && latestMessage.content) {
							ws.send(
								JSON.stringify({
									type: latestMessage.type || 'result',
									content: latestMessage.content,
									timestamp: latestMessage.timestamp,
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
		const { message } = await c.req.json()

		if (!message) {
			return c.json(
				{
					error: 'Missing message field',
				},
				400
			)
		}

		// Get agent instance
		const agentId = c.env.CLAUDE_CODE_AGENT.idFromName('claude-agent-session')
		const agent = c.env.CLAUDE_CODE_AGENT.get(agentId)

		// Process message
		await agent.processMessage(message)

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
