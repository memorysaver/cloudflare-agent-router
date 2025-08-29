import { ClaudeCodeService } from '../services/claude-code.service'

import type { Context } from 'hono'
import type { App } from '../context'
import type { ClaudeCodeError, ClaudeCodeRequest } from '../types/claude-code'

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

		// Validate and process request using shared service
		const validationResult = ClaudeCodeService.validateAndProcessRequest(requestBody)
		if (!validationResult.success) {
			return c.json<ClaudeCodeError>(validationResult.error, 400)
		}

		const options = validationResult.options

		// Prepare environment variables using shared service
		const envVars = ClaudeCodeService.prepareEnvironment(c)

		// Log request info
		if (options.inputFormat === 'text' && options.prompt) {
			console.log(
				`🤖 Processing Claude Code request with prompt: "${options.prompt.substring(0, 50)}..."`
			)
		} else if (options.inputFormat === 'stream-json' && options.messages) {
			console.log(`🤖 Processing Claude Code request with ${options.messages.length} messages`)
		}

		console.log(`🤖 Using LiteLLM router: ${envVars.ANTHROPIC_BASE_URL}`)
		console.log(`🤖 Request contains ${Object.keys(requestBody).length} parameters`)

		// Execute using shared service
		return await ClaudeCodeService.executeStreaming(options, envVars, c)
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
