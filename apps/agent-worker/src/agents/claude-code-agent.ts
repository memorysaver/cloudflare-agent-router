import { Agent } from 'agents'

import { ClaudeCodeService } from '../services/claude-code.service'

import type { AgentContext } from 'agents'
import type { Env } from '../context'
import type { ProcessedClaudeCodeOptions } from '../types/claude-code'

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
		preferredModel?: string
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
	private outputParser: ClaudeOutputParser

	// Type-safe state access
	get typedState(): AgentSessionState {
		try {
			return this.state as AgentSessionState
		} catch (error) {
			// If state is not yet initialized (SQLite table doesn't exist), return initial state
			console.log('State not yet initialized, returning initial state:', error)
			return this.initialState as AgentSessionState
		}
	}

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
			activeTools: [],
			preferredModel: 'groq/openai/gpt-oss-120b',
		},
		containerState: {
			isActive: false,
			lastHeartbeat: Date.now(),
		},
	}

	constructor(ctx: AgentContext, env: Env) {
		super(ctx, env)
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
				const { message } = (await request.json()) as { message: string }
				return await this.processMessageRequest(message)
			}

			return new Response('Agent ready', { status: 200 })
		} catch (error) {
			console.error('ClaudeCodeAgent onRequest error:', error)
			return new Response(`Error: ${error instanceof Error ? error.message : String(error)}`, {
				status: 500,
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
				// Process the user message with full ClaudeCodeRequest options
				const options: ProcessedClaudeCodeOptions = {
					prompt: data.content,
					sessionId: this.getSessionId(),
					model: this.getCurrentModel(),
					// Apply defaults
					inputFormat: 'text',
					outputFormat: 'json',
					stream: false,
					verbose: false,
					maxTurns: 10,
					systemPrompt: '',
					continueSession: true,
					permissionMode: 'acceptEdits',
					additionalArgs: [],
				}
				await this.processMessage(options)
			}
		} catch (error) {
			console.error('ClaudeCodeAgent onMessage error:', error)

			// Send error back via WebSocket
			if (connection && connection.send) {
				connection.send(
					JSON.stringify({
						type: 'error',
						content: `Error: ${error instanceof Error ? error.message : String(error)}`,
						timestamp: Date.now(),
					})
				)
			}
		}
	}

	/**
	 * Process message request via HTTP
	 */
	private async processMessageRequest(content: string): Promise<Response> {
		// Update running state
		this.setState({
			...this.typedState,
			isRunning: true,
			lastActivity: Date.now(),
		})

		try {
			// Create ProcessedClaudeCodeOptions for the request
			const options: ProcessedClaudeCodeOptions = {
				prompt: content,
				sessionId: this.getSessionId(),
				model: this.getCurrentModel(),
				// Apply defaults
				inputFormat: 'text',
				outputFormat: 'stream-json',
				stream: true,
				verbose: false,
				maxTurns: 10,
				systemPrompt: '',
				continueSession: true,
				permissionMode: 'acceptEdits',
				additionalArgs: [],
			}

			// Prepare environment variables
			const envVars = {
				ANTHROPIC_AUTH_TOKEN: this.env.ANTHROPIC_AUTH_TOKEN || 'auto-detect',
				ANTHROPIC_BASE_URL:
					this.env.ANTHROPIC_BASE_URL || 'https://litellm-router.memorysaver.workers.dev',
				ANTHROPIC_API_KEY: this.env.ANTHROPIC_API_KEY,
				ANTHROPIC_MODEL: options.model,
			}

			// Create minimal context for service call
			const context = {
				env: this.env,
				json: (data: any, status?: number) => ({ data, status }),
			} as any

			// Execute using shared service in streaming mode
			return await ClaudeCodeService.executeStreaming(options, envVars, context)
		} catch (error) {
			console.error('ClaudeCodeAgent processMessageRequest error:', error)
			return new Response(`Error: ${error instanceof Error ? error.message : String(error)}`, {
				status: 500,
			})
		} finally {
			this.setState({
				...this.typedState,
				isRunning: false,
				lastActivity: Date.now(),
			})
		}
	}

	/**
	 * Process incoming messages with full ClaudeCodeRequest options
	 */
	async processMessage(options: ProcessedClaudeCodeOptions): Promise<void> {
		console.log('Processing agent message:', options.prompt?.substring(0, 50) || 'No prompt')

		// Update session ID if provided
		if (options.sessionId) {
			this.setState({
				...this.typedState,
				claudeSession: {
					...this.typedState.claudeSession,
					id: options.sessionId,
				},
			})
		}

		// Store model preference if provided
		if (options.model) {
			this.setState({
				...this.typedState,
				claudeSession: {
					...this.typedState.claudeSession,
					preferredModel: options.model,
				},
			})
		}

		// Update running state
		this.setState({
			...this.typedState,
			isRunning: true,
			lastActivity: Date.now(),
		})

		try {
			// Add user message to conversation history
			const userContent =
				options.prompt || options.messages?.[0]?.content?.[0]?.text || 'No content'
			const userMessage: AgentMessage = {
				id: this.generateId(),
				role: 'user',
				content: userContent,
				type: 'result',
				timestamp: Date.now(),
			}
			this.addMessageToState(userMessage)

			// Execute Claude Code using shared service
			const envVars = {
				ANTHROPIC_AUTH_TOKEN: this.env.ANTHROPIC_AUTH_TOKEN || 'auto-detect',
				ANTHROPIC_BASE_URL:
					this.env.ANTHROPIC_BASE_URL || 'https://litellm-router.memorysaver.workers.dev',
				ANTHROPIC_API_KEY: this.env.ANTHROPIC_API_KEY,
				ANTHROPIC_MODEL: options.model,
			}

			// Create minimal context for service call
			const context = {
				env: this.env,
				json: (data: any, status?: number) => ({ data, status }),
			} as any

			const executionResult = await ClaudeCodeService.executeNonStreaming(options, envVars, context)

			// Process the single response and add to state
			await this.processClaudeResponse(executionResult)
		} catch (error) {
			console.error('ClaudeCodeAgent processMessage error:', error)

			// Store error message in state for WebSocket handler to retrieve
			const errorMessage: AgentMessage = {
				id: this.generateId(),
				role: 'assistant',
				content: `Error: ${error instanceof Error ? error.message : String(error)}`,
				type: 'error',
				timestamp: Date.now(),
			}
			this.addMessageToState(errorMessage)
		} finally {
			this.setState({
				...this.typedState,
				isRunning: false,
				lastActivity: Date.now(),
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
	 * Process single JSON response from Claude Code (non-streaming)
	 */
	private async processClaudeResponse(response: any): Promise<void> {
		console.log('Processing Claude response:', response)

		// Handle official Claude Code SDK response format
		if (response && response.type === 'result' && response.result !== undefined) {
			// Update session mapping with official session_id
			if (response.session_id && this.getSessionId() !== response.session_id) {
				this.setState({
					...this.typedState,
					claudeSession: {
						...this.typedState.claudeSession,
						id: response.session_id,
					},
				})
				console.log(`🗂️ Updated agent session ID to: ${response.session_id}`)
			}

			// Create assistant message from the SDK response
			const assistantMessage: AgentMessage = {
				id: this.generateId(),
				role: 'assistant',
				content: response.result,
				type: response.is_error
					? 'error'
					: response.subtype === 'success'
						? 'result'
						: response.subtype,
				timestamp: Date.now(),
			}

			this.addMessageToState(assistantMessage)
			console.log('Added assistant message to state:', assistantMessage)

			// Log SDK metadata for monitoring
			if (response.total_cost_usd) {
				console.log(`💰 Request cost: $${response.total_cost_usd}`)
			}
			if (response.duration_ms) {
				console.log(
					`⏱️ Total duration: ${response.duration_ms}ms (API: ${response.duration_api_ms}ms)`
				)
			}
			if (response.num_turns) {
				console.log(`🔄 Turns: ${response.num_turns}`)
			}
		} else if (response && response.content) {
			// Alternative response format
			const assistantMessage: AgentMessage = {
				id: this.generateId(),
				role: 'assistant',
				content: response.content,
				type: response.type || 'result',
				timestamp: Date.now(),
			}

			this.addMessageToState(assistantMessage)
			console.log('Added assistant message to state (alternative format):', assistantMessage)
		} else {
			console.warn('Unexpected Claude response format:', response)

			// Fallback: create error message
			const errorMessage: AgentMessage = {
				id: this.generateId(),
				role: 'assistant',
				content: 'Sorry, I received an unexpected response format.',
				type: 'error',
				timestamp: Date.now(),
			}

			this.addMessageToState(errorMessage)
		}
	}

	/**
	 * Add message to agent state
	 */
	private addMessageToState(message: AgentMessage): void {
		const currentMessages = this.typedState.messages || []
		this.setState({
			...this.typedState,
			messages: [...currentMessages, message],
			lastActivity: Date.now(),
		})
	}

	/**
	 * Get current agent state (for WebSocket handler)
	 */
	async getState(): Promise<AgentSessionState> {
		return this.typedState
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
		return this.typedState.claudeSession?.id || `session_${Date.now()}`
	}

	/**
	 * Get workspace path for session
	 */
	private getWorkspacePath(): string {
		return '/workspace'
	}

	/**
	 * Get current preferred model for session
	 */
	private getCurrentModel(): string {
		return this.typedState.claudeSession?.preferredModel || 'groq/openai/gpt-oss-120b'
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

// ClaudeContainerBridge removed - using shared ClaudeCodeService instead

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
		// eslint-disable-next-line no-control-regex
		const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '')

		// Skip empty lines
		if (!cleanLine.trim()) return null

		// Try to parse as Claude Code stream-json format first
		try {
			if (cleanLine.startsWith('{') && cleanLine.endsWith('}')) {
				const parsed = JSON.parse(cleanLine)

				// Handle official Claude Code stream-json formats
				if (parsed.type === 'result') {
					// Final result message with SDK format
					return {
						id: this.generateId(),
						role: 'assistant',
						content: parsed.result || 'No content',
						type: parsed.is_error
							? 'error'
							: parsed.subtype === 'success'
								? 'result'
								: parsed.subtype,
						timestamp: Date.now(),
					}
				} else if (parsed.type === 'assistant' && parsed.content) {
					// Assistant message during streaming
					return {
						id: this.generateId(),
						role: 'assistant',
						content: parsed.content,
						type: 'result',
						timestamp: Date.now(),
					}
				} else if (parsed.type === 'tool_call') {
					// Tool usage message
					return {
						id: this.generateId(),
						role: 'assistant',
						content: `Using tool: ${parsed.tool}${parsed.input ? ' with input: ' + JSON.stringify(parsed.input) : ''}`,
						type: 'tool_use',
						timestamp: Date.now(),
					}
				} else if (parsed.type === 'tool_result') {
					// Tool result message
					return {
						id: this.generateId(),
						role: 'assistant',
						content: `Tool ${parsed.tool} result: ${parsed.result}`,
						type: 'tool_use',
						timestamp: Date.now(),
					}
				} else if (parsed.type === 'system' && parsed.subtype === 'init') {
					// System initialization message - don't create agent message, just log
					console.log(`🔄 Claude session initialized: ${parsed.session_id}`)
					return null
				}
				// Other system messages or unknown formats are ignored
				return null
			}
		} catch {
			// Not JSON, continue with text parsing
		}

		// Detect message type and parse accordingly
		if (cleanLine.startsWith('🔧 ')) {
			return {
				id: this.generateId(),
				role: 'assistant',
				content: cleanLine.substring(2).trim(),
				type: 'tool_use',
				timestamp: Date.now(),
			}
		} else if (cleanLine.startsWith('❌ ')) {
			return {
				id: this.generateId(),
				role: 'assistant',
				content: cleanLine.substring(2).trim(),
				type: 'error',
				timestamp: Date.now(),
			}
		} else if (cleanLine.includes('file:')) {
			return {
				id: this.generateId(),
				role: 'assistant',
				content: cleanLine,
				type: 'file_change',
				timestamp: Date.now(),
			}
		} else {
			return {
				id: this.generateId(),
				role: 'assistant',
				content: cleanLine,
				type: 'result',
				timestamp: Date.now(),
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
