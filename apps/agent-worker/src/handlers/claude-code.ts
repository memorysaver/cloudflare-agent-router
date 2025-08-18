import type { Context } from 'hono'
import type { App } from '../context'

export interface ClaudeCodeRequest {
	// Required
	prompt: string

	// API Configuration
	model?: string                    // Default: "groq/openai/gpt-oss-120b"
	stream?: boolean                  // Default: true
	verbose?: boolean                 // Default: false

	// Claude Code SDK Core Options
	maxTurns?: number                // Default: 3
	systemPrompt?: string            // Default: "" (empty - let Claude Code use default)
	appendSystemPrompt?: string      // Default: undefined
	
	// Tool Management
	allowedTools?: string[]          // Default: undefined (all tools)
	disallowedTools?: string[]       // Default: undefined
	
	// Session Management
	continueSession?: boolean        // Default: false
	resumeSessionId?: string         // Default: undefined
	
	// Permission & Security
	permissionMode?: "default" | "acceptEdits" | "plan" | "bypassPermissions"  // Default: "acceptEdits"
	permissionPromptTool?: string    // Default: undefined
	
	// MCP Configuration
	mcpConfig?: string               // Default: undefined
	
	// Runtime Configuration
	cwd?: string                     // Default: undefined
	executable?: string              // Default: undefined
	executableArgs?: string[]        // Default: undefined
	pathToClaudeCodeExecutable?: string  // Default: undefined

	// Legacy (for backward compatibility)
	additionalArgs?: string[]        // Deprecated - use executableArgs
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

		// Validate required fields
		if (!requestBody.prompt) {
			return c.json<ClaudeCodeError>(
				{
					error: 'Missing prompt',
					message: 'Request must include a prompt field',
				},
				400
			)
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

		console.log(
			`🤖 Processing Claude Code request with prompt: "${requestBody.prompt.substring(0, 50)}..."`
		)

		// Prepare complete Claude Code options with defaults
		const options: ClaudeCodeRequest = {
			// Required
			prompt: requestBody.prompt,

			// API Configuration with user's preferred defaults
			model: requestBody.model || 'groq/openai/gpt-oss-120b',
			stream: requestBody.stream !== false, // Default to true
			verbose: requestBody.verbose || false,

			// Claude Code SDK Core Options
			maxTurns: requestBody.maxTurns || 3,
			systemPrompt: requestBody.systemPrompt !== undefined ? requestBody.systemPrompt : '', // Default to empty string
			appendSystemPrompt: requestBody.appendSystemPrompt,

			// Tool Management
			allowedTools: requestBody.allowedTools,
			disallowedTools: requestBody.disallowedTools,

			// Session Management
			continueSession: requestBody.continueSession || false,
			resumeSessionId: requestBody.resumeSessionId,

			// Permission & Security
			permissionMode: requestBody.permissionMode || 'acceptEdits',
			permissionPromptTool: requestBody.permissionPromptTool,

			// MCP Configuration
			mcpConfig: requestBody.mcpConfig,

			// Runtime Configuration
			cwd: requestBody.cwd,
			executable: requestBody.executable,
			executableArgs: requestBody.executableArgs,
			pathToClaudeCodeExecutable: requestBody.pathToClaudeCodeExecutable,

			// Legacy support
			additionalArgs: requestBody.additionalArgs || requestBody.executableArgs || [],
		}

		// Prepare environment variables (API configuration only)
		const envVars: Record<string, string> = {
			ANTHROPIC_AUTH_TOKEN: c.env.ANTHROPIC_AUTH_TOKEN || 'auto-detect',
			ANTHROPIC_BASE_URL: c.env.ANTHROPIC_BASE_URL || 'https://litellm-router.memorysaver.workers.dev',
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

		// Get container instance
		const id = c.env.CLAUDE_CONTAINER.idFromName('claude-execution')
		const container = c.env.CLAUDE_CONTAINER.get(id)

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
