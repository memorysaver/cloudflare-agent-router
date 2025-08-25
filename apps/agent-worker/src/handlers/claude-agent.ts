import type { Context } from 'hono'
import { upgradeWebSocket } from 'hono/cloudflare-workers'
import type { WSContext } from 'hono/ws'
import type { App } from '../context'
import { ClaudeCodeAgent } from '../agents/claude-code-agent'

/**
 * WebSocket message types
 */
interface WSMessage {
	type: 'user_message' | 'agent_response' | 'error' | 'status'
	content?: string
	data?: unknown
	timestamp?: number
}

/**
 * Handle WebSocket upgrade for Claude Code Agent
 */
export function handleAgentWebSocket(c: Context<App>) {
	return upgradeWebSocket((c) => ({
		onOpen: async (event, ws: WSContext) => {
			console.log('🔌 WebSocket connection opened')
			
			// Send welcome message
			ws.send(JSON.stringify({
				type: 'status',
				content: 'Connected to Claude Code Agent',
				timestamp: Date.now()
			} as WSMessage))
		},

		onMessage: async (event, ws: WSContext) => {
			try {
				const message = JSON.parse(event.data as string) as WSMessage
				console.log('📨 Received WebSocket message:', message)

				if (message.type === 'user_message' && message.content) {
					// Get or create agent instance
					const agentId = c.env.CLAUDE_CODE_AGENT.idFromName('claude-agent-session')
					const agent = c.env.CLAUDE_CODE_AGENT.get(agentId)

					// Process message through agent
					await agent.processMessage(message.content)

					// Note: Real-time responses will be sent via agent.broadcast()
					// which would need to be connected to this WebSocket
					// For now, send confirmation
					ws.send(JSON.stringify({
						type: 'status',
						content: 'Message received and processing...',
						timestamp: Date.now()
					} as WSMessage))
				}
			} catch (error) {
				console.error('❌ WebSocket message processing error:', error)
				
				ws.send(JSON.stringify({
					type: 'error',
					content: `Error processing message: ${error instanceof Error ? error.message : String(error)}`,
					timestamp: Date.now()
				} as WSMessage))
			}
		},

		onClose: async (event, ws: WSContext) => {
			console.log('🔌 WebSocket connection closed')
		},

		onError: async (event, ws: WSContext) => {
			console.error('❌ WebSocket error:', event)
		}
	}))(c)
}

/**
 * Handle agent REST endpoint for non-WebSocket clients
 */
export async function handleAgentMessage(c: Context<App>): Promise<Response> {
	try {
		const { message } = await c.req.json()

		if (!message) {
			return c.json({
				error: 'Missing message field'
			}, 400)
		}

		// Get agent instance
		const agentId = c.env.CLAUDE_CODE_AGENT.idFromName('claude-agent-session')
		const agent = c.env.CLAUDE_CODE_AGENT.get(agentId)

		// Process message
		await agent.processMessage(message)

		return c.json({
			status: 'Message processed',
			timestamp: Date.now()
		})

	} catch (error) {
		console.error('❌ Agent message handler error:', error)
		return c.json({
			error: 'Internal server error',
			details: error instanceof Error ? error.message : String(error)
		}, 500)
	}
}