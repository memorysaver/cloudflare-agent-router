import type { Context } from 'hono'
import type { ClaudeCodeOptions } from '../claude-container'
import type { App } from '../context'

export interface ClaudeCodeRequest {
	prompt: string
	model?: string
	stream?: boolean
	verbose?: boolean
	additionalArgs?: string[]
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

		// Prepare Claude Code options
		const options: ClaudeCodeOptions = {
			prompt: requestBody.prompt,
			model: requestBody.model || 'claude-3-5-sonnet-20241022',
			stream: requestBody.stream !== false, // Default to true
			verbose: requestBody.verbose || false,
			additionalArgs: requestBody.additionalArgs || [],
		}

		// Prepare environment variables
		const envVars: Record<string, string> = {
			ANTHROPIC_AUTH_TOKEN: 'auto-detect',
			ANTHROPIC_BASE_URL: c.env.ANTHROPIC_BASE_URL || 'https://litellm-router.memorysaver.workers.dev',
			ANTHROPIC_MODEL: options.model || 'openrouter/qwen/qwen3-coder',
			ANTHROPIC_SMALL_FAST_MODEL: 'openrouter/qwen/qwen3-coder',
		}

		// Add optional environment variables if they exist (override defaults if provided)
		if (c.env.ANTHROPIC_AUTH_TOKEN && c.env.ANTHROPIC_AUTH_TOKEN !== 'auto-detect') {
			envVars.ANTHROPIC_AUTH_TOKEN = c.env.ANTHROPIC_AUTH_TOKEN
		}
		if (c.env.ANTHROPIC_API_KEY) {
			envVars.ANTHROPIC_API_KEY = c.env.ANTHROPIC_API_KEY
		}
		if (c.env.ANTHROPIC_BASE_URL) {
			envVars.ANTHROPIC_BASE_URL = c.env.ANTHROPIC_BASE_URL
		}

		console.log(`🤖 Using LiteLLM router: ${envVars.ANTHROPIC_BASE_URL}`)
		console.log(`🤖 Using model: ${envVars.ANTHROPIC_MODEL}`)
		console.log(`🤖 Auth mode: ${envVars.ANTHROPIC_AUTH_TOKEN}`)

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
