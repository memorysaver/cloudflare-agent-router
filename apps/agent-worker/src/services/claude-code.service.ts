import type { Context } from 'hono'
import type { App } from '../context'
import type {
	ClaudeCodeRequest,
	ClaudeCodeError,
	ProcessedClaudeCodeOptions,
	ClaudeCodeEnvVars,
	LegacyAgentRequest,
} from '../types/claude-code'

/**
 * Shared Claude Code Service
 * Single source of truth for Claude Code request processing and execution
 */
export class ClaudeCodeService {
	/**
	 * Convert legacy agent request to unified ClaudeCodeRequest format
	 */
	static normalizeAgentRequest(body: any): ClaudeCodeRequest {
		// Check if this is legacy format {message, sessionId}
		if (body.message && typeof body.message === 'string' && !body.prompt && !body.messages) {
			const legacyRequest = body as LegacyAgentRequest
			return {
				prompt: legacyRequest.message,
				sessionId: legacyRequest.sessionId,
				permissionMode: legacyRequest.permissionMode || 'acceptEdits',
				// Apply other defaults (will be handled by validateAndProcessRequest)
			}
		}

		// New format - use as-is
		return body as ClaudeCodeRequest
	}

	/**
	 * Validate request and apply defaults to create ProcessedClaudeCodeOptions
	 */
	static validateAndProcessRequest(request: ClaudeCodeRequest): {
		success: true
		options: ProcessedClaudeCodeOptions
	} | {
		success: false
		error: ClaudeCodeError
	} {
		try {
			// Validate required fields based on input format
			const inputFormat = request.inputFormat || 'text'

			if (inputFormat === 'text') {
				if (!request.prompt) {
					return {
						success: false,
						error: {
							error: 'Missing prompt',
							message: 'Request must include a prompt field when using text input format',
						},
					}
				}
			} else if (inputFormat === 'stream-json') {
				if (
					!request.messages ||
					!Array.isArray(request.messages) ||
					request.messages.length === 0
				) {
					return {
						success: false,
						error: {
							error: 'Missing messages',
							message: 'Request must include a messages array when using stream-json input format',
						},
					}
				}
			}

			// Apply defaults to create ProcessedClaudeCodeOptions
			const options: ProcessedClaudeCodeOptions = {
				// Input content (based on format)
				prompt: request.prompt,
				messages: request.messages,

				// Format Configuration
				inputFormat: inputFormat,
				outputFormat:
					request.outputFormat || (request.stream !== false ? 'stream-json' : 'json'),

				// API Configuration with user's preferred defaults
				model: request.model || 'groq/openai/gpt-oss-120b',
				stream: request.stream !== false, // Keep for compatibility
				verbose: request.verbose || false,

				// Claude Code SDK Core Options
				maxTurns: request.maxTurns || 10,
				systemPrompt: request.systemPrompt !== undefined ? request.systemPrompt : '', // Default to empty string
				appendSystemPrompt: request.appendSystemPrompt,

				// Tool Management
				allowedTools: request.allowedTools,
				disallowedTools: request.disallowedTools,

				// Session Management
				sessionId: request.sessionId,
				continueSession: request.sessionId ? true : request.continueSession || false,
				resumeSessionId: request.resumeSessionId,

				// Permission & Security
				permissionMode: request.permissionMode || 'acceptEdits',
				permissionPromptTool: request.permissionPromptTool,

				// MCP Configuration
				mcpConfig: request.mcpConfig,

				// Runtime Configuration
				cwd: request.cwd,
				executable: request.executable,
				executableArgs: request.executableArgs,
				pathToClaudeCodeExecutable: request.pathToClaudeCodeExecutable,

				// Legacy support
				additionalArgs: request.additionalArgs || request.executableArgs || [],
			}

			// Session Management - simplified for shared workspace architecture
			if (options.sessionId) {
				// Auto-enable session resumption when sessionId provided
				// Use shared workspace instead of session-specific directories
				options.cwd = options.cwd || '/workspace'
			}

			return {
				success: true,
				options,
			}
		} catch (error) {
			return {
				success: false,
				error: {
					error: 'Request validation failed',
					message: 'Failed to validate and process Claude Code request',
					details: error instanceof Error ? error.message : String(error),
				},
			}
		}
	}

	/**
	 * Prepare environment variables for Claude Code execution
	 */
	static prepareEnvironment(context: Context<App>): ClaudeCodeEnvVars {
		return {
			ANTHROPIC_AUTH_TOKEN: context.env.ANTHROPIC_AUTH_TOKEN || 'auto-detect',
			ANTHROPIC_BASE_URL:
				context.env.ANTHROPIC_BASE_URL || 'https://litellm-router.memorysaver.workers.dev',
			ANTHROPIC_API_KEY: context.env.ANTHROPIC_API_KEY,
			ANTHROPIC_MODEL: '', // Will be set during execution
		}
	}

	/**
	 * Execute Claude Code in streaming mode
	 */
	static async executeStreaming(
		options: ProcessedClaudeCodeOptions,
		envVars: ClaudeCodeEnvVars,
		context: Context<App>
	): Promise<Response> {
		// Check container availability
		if (!context.env.CLAUDE_CONTAINER) {
			return context.json<ClaudeCodeError>(
				{
					error: 'Container not configured',
					message: 'Claude Code container is not available. Please check your configuration.',
				},
				503
			)
		}

		// Update environment variables with model
		const executionEnvVars = {
			...envVars,
			ANTHROPIC_MODEL: options.model,
		}

		// Log execution details
		console.log(`🤖 Executing Claude Code (streaming) with model: ${options.model}`)
		console.log(`🤖 Permission Mode: ${options.permissionMode}`)
		console.log(`🤖 Session ID: ${options.sessionId || '[None]'}`)

		// Get session-specific container instance
		const containerId = options.sessionId ? `claude-session-${options.sessionId}` : 'claude-execution'
		const id = context.env.CLAUDE_CONTAINER.idFromName(containerId)
		const container = context.env.CLAUDE_CONTAINER.get(id)

		console.log(`🤖 Using container: ${containerId}`)

		// Execute Claude Code and return the streaming response
		return await container.executeClaudeCode(options, executionEnvVars)
	}

	/**
	 * Execute Claude Code in non-streaming mode (for agent persistence)
	 */
	static async executeNonStreaming(
		options: ProcessedClaudeCodeOptions,
		envVars: ClaudeCodeEnvVars,
		context: Context<App>
	): Promise<any> {
		// Check container availability
		if (!context.env.CLAUDE_CONTAINER) {
			throw new Error('Claude Code container is not available. Please check your configuration.')
		}

		// Force non-streaming mode
		const nonStreamingOptions = {
			...options,
			stream: false,
			outputFormat: 'json' as const,
		}

		// Update environment variables with model
		const executionEnvVars = {
			...envVars,
			ANTHROPIC_MODEL: nonStreamingOptions.model,
		}

		// Log execution details
		console.log(`🤖 Executing Claude Code (non-streaming) with model: ${nonStreamingOptions.model}`)
		console.log(`🤖 Permission Mode: ${nonStreamingOptions.permissionMode}`)
		console.log(`🤖 Session ID: ${nonStreamingOptions.sessionId || '[None]'}`)

		// Get session-specific container instance
		const containerId = nonStreamingOptions.sessionId
			? `claude-session-${nonStreamingOptions.sessionId}`
			: 'claude-execution'
		const id = context.env.CLAUDE_CONTAINER.idFromName(containerId)
		const container = context.env.CLAUDE_CONTAINER.get(id)

		console.log(`🤖 Using container: ${containerId}`)

		// Execute and return JSON response
		const response = await container.executeClaudeCode(nonStreamingOptions, executionEnvVars)
		return await response.json()
	}
}