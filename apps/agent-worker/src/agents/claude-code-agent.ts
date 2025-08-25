import { Agent, type AgentContext } from 'agents'
import type { Env } from '../context'
import { ClaudeCodeContainer } from '../claude-container'
import type { ClaudeCodeOptions } from '../claude-container'

/**
 * Message types for structured communication
 */
export interface AgentMessage {
	id: string
	role: 'user' | 'assistant'
	content: string
	type?: 'progress' | 'result' | 'error' | 'tool_use' | 'file_change'
	timestamp: number
}

/**
 * Agent session state schema
 */
export interface AgentSessionState {
	// Agent framework standard state
	messages: AgentMessage[]
	isRunning: boolean
	lastActivity: number

	// Claude Code specific state
	claudeSession: {
		id: string
		workspacePath: string
		lastCommand: string
		sessionFiles: string[]
		activeTools: string[]
	}

	// Container management
	containerState: {
		isActive: boolean
		lastHeartbeat: number
	}
}

/**
 * Claude Code Agent - Integrates Claude Code SDK with Cloudflare Agent Framework
 * 
 * This agent extends Agent to provide real-time WebSocket communication
 * while leveraging the existing ClaudeCodeContainer infrastructure.
 */
export class ClaudeCodeAgent extends Agent<Env> {
	private containerBridge: ClaudeContainerBridge
	private outputParser: ClaudeOutputParser

	/**
	 * Initial state for the Agent
	 */
	initialState = {
		messages: [],
		isRunning: false,
		lastActivity: Date.now(),
		claudeSession: {
			id: `session_${Date.now()}`,
			workspacePath: '/workspace',
			lastCommand: '',
			sessionFiles: [],
			activeTools: []
		},
		containerState: {
			isActive: false,
			lastHeartbeat: Date.now()
		}
	}

	constructor(ctx: AgentContext, env: Env) {
		super(ctx, env)
		this.containerBridge = new ClaudeContainerBridge(env)
		this.outputParser = new ClaudeOutputParser()
	}

	/**
	 * Handle HTTP requests (Agent method)
	 */
	async onRequest(request: Request): Promise<Response> {
		try {
			const url = new URL(request.url)
			
			if (request.method === 'POST' && url.pathname.endsWith('/message')) {
				// Handle message via HTTP
				const { message } = await request.json()
				return await this.processMessageRequest(message)
			}
			
			return new Response('Agent ready', { status: 200 })
		} catch (error) {
			console.error('ClaudeCodeAgent onRequest error:', error)
			return new Response(`Error: ${error instanceof Error ? error.message : String(error)}`, {
				status: 500
			})
		}
	}

	/**
	 * Handle WebSocket messages (Agent method)
	 */
	async onMessage(connection: any, message: any): Promise<void> {
		try {
			console.log('Received WebSocket message:', message)
			
			// Parse message data
			const data = typeof message.data === 'string' ? JSON.parse(message.data) : message.data
			
			if (data.type === 'user_message' && data.content) {
				// Process the user message with WebSocket connection for real-time responses
				await this.processMessage(data.content, connection)
			}
		} catch (error) {
			console.error('ClaudeCodeAgent onMessage error:', error)
			
			// Send error back via WebSocket
			if (connection && connection.send) {
				connection.send(JSON.stringify({
					type: 'error',
					content: `Error: ${error instanceof Error ? error.message : String(error)}`,
					timestamp: Date.now()
				}))
			}
		}
	}

	/**
	 * Process message request via HTTP
	 */
	private async processMessageRequest(content: string): Promise<Response> {
		// Update running state
		this.setState({
			...this.state,
			isRunning: true,
			lastActivity: Date.now()
		})

		try {
			// Execute Claude Code via container
			const executionStream = await this.containerBridge.execute(content, {
				sessionId: this.getSessionId(),
				workspacePath: this.getWorkspacePath(),
				context: this.getConversationContext()
			})

			// Create a streaming response
			return new Response(executionStream, {
				headers: {
					'Content-Type': 'text/plain; charset=utf-8',
					'Transfer-Encoding': 'chunked'
				}
			})

		} catch (error) {
			console.error('ClaudeCodeAgent processMessageRequest error:', error)
			return new Response(`Error: ${error instanceof Error ? error.message : String(error)}`, {
				status: 500
			})
		} finally {
			this.setState({
				...this.state,
				isRunning: false,
				lastActivity: Date.now()
			})
		}
	}

	/**
	 * Process incoming user messages (for WebSocket calls)
	 */
	async processMessage(content: string): Promise<void> {
		console.log('Processing WebSocket message:', content)
		
		// Update running state
		this.setState({
			...this.state,
			isRunning: true,
			lastActivity: Date.now()
		})

		try {
			// Execute Claude Code via container
			const executionStream = await this.containerBridge.execute(content, {
				sessionId: this.getSessionId(),
				workspacePath: this.getWorkspacePath(),
				context: this.getConversationContext()
			})

			// Process the streaming response
			await this.processClaudeStream(executionStream)

		} catch (error) {
			console.error('ClaudeCodeAgent processMessage error:', error)
			
			// Store error message in state for WebSocket handler to retrieve
			const errorMessage: AgentMessage = {
				id: this.generateId(),
				role: 'assistant',
				content: `Error: ${error instanceof Error ? error.message : String(error)}`,
				type: 'error',
				timestamp: Date.now()
			}
			this.addMessageToState(errorMessage)
		} finally {
			this.setState({
				...this.state,
				isRunning: false,
				lastActivity: Date.now()
			})
		}
	}

	/**
	 * Process streaming output from Claude Code
	 */
	private async processClaudeStream(stream: ReadableStream): Promise<void> {
		const reader = stream.getReader()
		let buffer = ''

		try {
			while (true) {
				const { done, value } = await reader.read()
				if (done) break

				buffer += new TextDecoder().decode(value)
				const messages = this.outputParser.parseBuffer(buffer)

				for (const message of messages) {
					this.addMessageToState(message)
					console.log('Parsed message:', message)
					
					// Messages are now stored in state and retrieved by the WebSocket handler
				}
			}
		} finally {
			reader.releaseLock()
		}
	}

	/**
	 * Add message to agent state
	 */
	private addMessageToState(message: AgentMessage): void {
		const currentMessages = this.state.messages || []
		this.setState({
			...this.state,
			messages: [...currentMessages, message],
			lastActivity: Date.now()
		})
	}

	/**
	 * Get current agent state (for WebSocket handler)
	 */
	async getState(): Promise<AgentSessionState> {
		return this.state
	}

	/**
	 * Get conversation context for Claude Code
	 */
	private getConversationContext(): string {
		// For now, return empty context since we're using base Agent
		// In a full implementation, you'd maintain message history in agent state
		return ''
	}

	/**
	 * Generate unique message ID
	 */
	private generateId(): string {
		return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	}

	/**
	 * Get current session ID
	 */
	private getSessionId(): string {
		return this.state.claudeSession?.id || `session_${Date.now()}`
	}

	/**
	 * Get workspace path for session
	 */
	private getWorkspacePath(): string {
		return this.state.claudeSession?.workspacePath || '/workspace'
	}

	/**
	 * Handle execution errors
	 */
	private async handleError(error: unknown): Promise<void> {
		console.error('ClaudeCodeAgent error:', error)
		// Error handling can be done through the response or state
		// AIChatAgent will handle message management
	}
}

/**
 * Container Bridge - Interfaces with existing ClaudeCodeContainer
 */
export class ClaudeContainerBridge {
	private env: Env

	constructor(env: Env) {
		this.env = env
	}

	/**
	 * Execute Claude Code with agent context
	 */
	async execute(
		prompt: string,
		options: {
			sessionId: string
			workspacePath: string
			context: string
		}
	): Promise<ReadableStream> {
		// Prepare Claude Code execution options
		const claudeOptions: ClaudeCodeOptions = {
			prompt,
			sessionId: options.sessionId,
			cwd: options.workspacePath,
			stream: true,
			verbose: false,
			maxTurns: 10,
			permissionMode: 'acceptEdits',
			// Include conversation context as system prompt appendix
			appendSystemPrompt: `Previous conversation context:\n${options.context}`,
		}

		// Prepare environment variables
		const envVars: Record<string, string> = {
			ANTHROPIC_AUTH_TOKEN: this.env.ANTHROPIC_AUTH_TOKEN || 'auto-detect',
			ANTHROPIC_BASE_URL: this.env.ANTHROPIC_BASE_URL || 'https://litellm-router.memorysaver.workers.dev',
		}

		if (this.env.ANTHROPIC_API_KEY) {
			envVars.ANTHROPIC_API_KEY = this.env.ANTHROPIC_API_KEY
		}

		// Get container instance
		const id = this.env.CLAUDE_CONTAINER.idFromName('claude-execution')
		const container = this.env.CLAUDE_CONTAINER.get(id)

		// Execute and return stream
		const response = await container.executeClaudeCode(claudeOptions, envVars)
		return response.body!
	}
}

/**
 * Output Parser - Converts CLI output to structured messages
 */
export class ClaudeOutputParser {
	private buffer: string = ''

	/**
	 * Parse streaming CLI output into structured messages
	 */
	parseBuffer(newData: string): AgentMessage[] {
		this.buffer += newData
		const lines = this.buffer.split('\n')

		// Keep last incomplete line in buffer
		this.buffer = lines.pop() || ''

		const messages: AgentMessage[] = []

		for (const line of lines) {
			const message = this.parseLine(line)
			if (message) {
				messages.push(message)
			}
		}

		return messages
	}

	/**
	 * Parse individual line into message
	 */
	private parseLine(line: string): AgentMessage | null {
		// Remove ANSI escape codes
		const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '')

		// Skip empty lines
		if (!cleanLine.trim()) return null

		// Try to parse as Claude Code JSON response first
		try {
			if (cleanLine.startsWith('{') && cleanLine.endsWith('}')) {
				const parsed = JSON.parse(cleanLine)
				if (parsed.type && parsed.result !== undefined) {
					return {
						id: this.generateId(),
						role: 'assistant',
						content: parsed.result,
						type: parsed.type === 'result' ? 'result' : parsed.type,
						timestamp: Date.now()
					}
				}
			}
		} catch (error) {
			// Not JSON, continue with text parsing
		}

		// Detect message type and parse accordingly
		if (cleanLine.startsWith('🔧 ')) {
			return {
				id: this.generateId(),
				role: 'assistant',
				content: cleanLine.substring(2).trim(),
				type: 'tool_use',
				timestamp: Date.now()
			}
		} else if (cleanLine.startsWith('❌ ')) {
			return {
				id: this.generateId(),
				role: 'assistant',
				content: cleanLine.substring(2).trim(),
				type: 'error',
				timestamp: Date.now()
			}
		} else if (cleanLine.includes('file:')) {
			return {
				id: this.generateId(),
				role: 'assistant',
				content: cleanLine,
				type: 'file_change',
				timestamp: Date.now()
			}
		} else {
			return {
				id: this.generateId(),
				role: 'assistant',
				content: cleanLine,
				type: 'result',
				timestamp: Date.now()
			}
		}
	}

	/**
	 * Generate unique message ID
	 */
	private generateId(): string {
		return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	}
}