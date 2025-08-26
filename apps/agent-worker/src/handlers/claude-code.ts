import type { Context } from 'hono'
import type { App } from '../context'

export interface ClaudeCodeRequest {
	// Required (prompt for text format, messages for stream-json format)
	prompt?: string
	messages?: Array<{
		role: 'user' | 'assistant'
		content: Array<{
			type: 'text'
			text: string
		}>
	}>

	// Input/Output Format Configuration
	inputFormat?: 'text' | 'stream-json' // Default: "text"
	outputFormat?: 'text' | 'json' | 'stream-json' // Default: "json"
	model?: string // Default: "groq/openai/gpt-oss-120b"
	stream?: boolean // Default: true (deprecated - use outputFormat instead)
	verbose?: boolean // Default: false

	// Claude Code SDK Core Options
	maxTurns?: number // Default: 3
	systemPrompt?: string // Default: "" (empty - let Claude Code use default)
	appendSystemPrompt?: string // Default: undefined

	// Tool Management
	allowedTools?: string[] // Default: undefined (all tools)
	disallowedTools?: string[] // Default: undefined

	// Session Management
	sessionId?: string // Optional: provide to resume existing session
	continueSession?: boolean // Default: false
	resumeSessionId?: string // Default: undefined

	// Permission & Security
	permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions' // Default: "acceptEdits"
	permissionPromptTool?: string // Default: undefined

	// MCP Configuration
	mcpConfig?: object // Default: undefined (JSON object that will be saved as .mcp.json)

	// Runtime Configuration
	cwd?: string // Default: undefined
	executable?: string // Default: undefined
	executableArgs?: string[] // Default: undefined
	pathToClaudeCodeExecutable?: string // Default: undefined

	// Legacy (for backward compatibility)
	additionalArgs?: string[] // Deprecated - use executableArgs
}

export interface ClaudeCodeError {
	error: string
	message: string
	details?: string
}

/**
 * Handle Claude Code execution requests
 * @param c - Hono context
 * @returns Streaming response from Claude Code CLI
 */
export async function handleClaudeCode(c: Context<App>): Promise<Response> {
	try {
		// Parse request body
		let requestBody: ClaudeCodeRequest
		try {
			requestBody = await c.req.json()
		} catch (error) {
			return c.json<ClaudeCodeError>(
				{
					error: 'Invalid request body',
					message: 'Request body must be valid JSON',
					details: error instanceof Error ? error.message : String(error),
				},
				400
			)
		}

		// Validate required fields based on input format
		const inputFormat = requestBody.inputFormat || 'text'

		if (inputFormat === 'text') {
			if (!requestBody.prompt) {
				return c.json<ClaudeCodeError>(
					{
						error: 'Missing prompt',
						message: 'Request must include a prompt field when using text input format',
					},
					400
				)
			}
		} else if (inputFormat === 'stream-json') {
			if (
				!requestBody.messages ||
				!Array.isArray(requestBody.messages) ||
				requestBody.messages.length === 0
			) {
				return c.json<ClaudeCodeError>(
					{
						error: 'Missing messages',
						message: 'Request must include a messages array when using stream-json input format',
					},
					400
				)
			}
		}

		// Check container availability
		if (!c.env.CLAUDE_CONTAINER) {
			return c.json<ClaudeCodeError>(
				{
					error: 'Container not configured',
					message: 'Claude Code container is not available. Please check your configuration.',
				},
				503
			)
		}

		// Log request info based on input format
		if (inputFormat === 'text' && requestBody.prompt) {
			console.log(
				`🤖 Processing Claude Code request with prompt: "${requestBody.prompt.substring(0, 50)}..."`
			)
		} else if (inputFormat === 'stream-json' && requestBody.messages) {
			console.log(`🤖 Processing Claude Code request with ${requestBody.messages.length} messages`)
		}

		// ULTRA-SIMPLE Session Management: Apply logic in Worker before container
		let sessionWorkspacePath = requestBody.cwd

		if (requestBody.sessionId) {
			// Auto-enable session resumption when sessionId provided
			// Use shared workspace instead of session-specific directories
			sessionWorkspacePath = sessionWorkspacePath || '/workspace'
			console.log(`🗂️ Session resumption enabled for session: ${requestBody.sessionId}`)
			console.log(`📁 Working directory set to: ${sessionWorkspacePath} (shared workspace)`)
		} else {
			console.log('🆕 New session will be created (no sessionId provided)')
		}

		// Prepare complete Claude Code options with defaults
		const options: ClaudeCodeRequest = {
			// Input content (based on format)
			prompt: requestBody.prompt,
			messages: requestBody.messages,

			// Format Configuration
			inputFormat: inputFormat,
			outputFormat:
				requestBody.outputFormat || (requestBody.stream !== false ? 'stream-json' : 'json'),

			// API Configuration with user's preferred defaults
			model: requestBody.model || 'groq/openai/gpt-oss-120b',
			stream: requestBody.stream !== false, // Keep for compatibility
			verbose: requestBody.verbose || false,

			// Claude Code SDK Core Options
			maxTurns: requestBody.maxTurns || 10,
			systemPrompt: requestBody.systemPrompt !== undefined ? requestBody.systemPrompt : '', // Default to empty string
			appendSystemPrompt: requestBody.appendSystemPrompt,

			// Tool Management
			allowedTools: requestBody.allowedTools,
			disallowedTools: requestBody.disallowedTools,

			// Session Management - simplified for shared workspace architecture
			sessionId: requestBody.sessionId,
			continueSession: requestBody.sessionId ? true : requestBody.continueSession || false,

			// Permission & Security
			permissionMode: requestBody.permissionMode || 'acceptEdits',
			permissionPromptTool: requestBody.permissionPromptTool,

			// MCP Configuration
			mcpConfig: requestBody.mcpConfig,

			// Runtime Configuration
			cwd: sessionWorkspacePath, // Use session workspace path when sessionId provided
			executable: requestBody.executable,
			executableArgs: requestBody.executableArgs,
			pathToClaudeCodeExecutable: requestBody.pathToClaudeCodeExecutable,

			// Legacy support
			additionalArgs: requestBody.additionalArgs || requestBody.executableArgs || [],
		}

		// Prepare environment variables (API configuration only)
		const envVars: Record<string, string> = {
			ANTHROPIC_AUTH_TOKEN: c.env.ANTHROPIC_AUTH_TOKEN || 'auto-detect',
			ANTHROPIC_BASE_URL:
				c.env.ANTHROPIC_BASE_URL || 'https://litellm-router.memorysaver.workers.dev',
		}

		// Add optional API key if provided
		if (c.env.ANTHROPIC_API_KEY) {
			envVars.ANTHROPIC_API_KEY = c.env.ANTHROPIC_API_KEY
		}

		console.log(`🤖 Using LiteLLM router: ${envVars.ANTHROPIC_BASE_URL}`)
		console.log(`🤖 Using model: ${options.model}`)
		console.log(`🤖 Auth mode: ${envVars.ANTHROPIC_AUTH_TOKEN}`)
		console.log(`🤖 Request contains ${Object.keys(requestBody).length} parameters`)

		// Skip API key validation since we're using auto-detect with LiteLLM router

		// Get session-specific container instance
		const containerId = requestBody.sessionId
			? `claude-session-${requestBody.sessionId}`
			: 'claude-execution'
		const id = c.env.CLAUDE_CONTAINER.idFromName(containerId)
		const container = c.env.CLAUDE_CONTAINER.get(id)

		console.log(`🤖 Using container: ${containerId}`)

		// Execute Claude Code and return the streaming response
		console.log(`🤖 Executing Claude Code in container...`)
		const response = await container.executeClaudeCode(options, envVars)

		console.log(`🤖 Container response status: ${response.status}`)
		return response
	} catch (error) {
		console.error('🤖 Claude Code handler error:', error)
		return c.json<ClaudeCodeError>(
			{
				error: 'Claude Code execution failed',
				message: 'Internal server error processing Claude Code request',
				details: error instanceof Error ? error.message : String(error),
			},
			500
		)
	}
}
