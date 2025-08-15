import { Container } from '@cloudflare/containers'

export interface ClaudeCodeOptions {
	prompt: string
	model?: string
	stream?: boolean
	verbose?: boolean
	additionalArgs?: string[]
}

/**
 * Claude Code Container - Executes Claude Code SDK via HTTP server
 *
 * This container runs a Hono HTTP server that uses the Claude Code SDK
 * to process requests and stream responses back to the client.
 */
export class ClaudeCodeContainer extends Container {
	// Default port for the HTTP server
	defaultPort = 3000

	// Enable internet access for Anthropic API calls
	enableInternet = true

	// Container will stay alive for multiple requests
	sleepAfter = '10m'

	/**
	 * Lifecycle method called when container starts
	 */
	override onStart(): void {
		console.log('🤖 Claude Code Container started')
	}

	/**
	 * Lifecycle method called when container shuts down
	 */
	override onStop(): void {
		console.log('🤖 Claude Code Container stopped')
	}

	/**
	 * Lifecycle method called when container encounters an error
	 */
	override onError(error: unknown): void {
		console.error('🤖 Claude Code Container error:', error)
	}

	/**
	 * Execute Claude Code with dynamic configuration via HTTP server
	 * @param options - Claude Code execution options
	 * @param envVars - Environment variables for API keys and configuration
	 */
	async executeClaudeCode(
		options: ClaudeCodeOptions,
		envVars: Record<string, string>
	): Promise<Response> {
		// Set environment variables for the HTTP server
		this.envVars = {
			...envVars,
			CLAUDE_PROMPT: options.prompt,
			ANTHROPIC_MODEL: options.model || 'claude-3-5-sonnet-20241022',
			CLAUDE_STREAM: options.stream ? 'true' : 'false',
			CLAUDE_VERBOSE: options.verbose ? 'true' : 'false',
			CLAUDE_MAX_TURNS: '1', // Default to single turn
		}

		console.log(`🤖 Starting Claude Code container with model: ${this.envVars.ANTHROPIC_MODEL}`)

		// Start the container (HTTP server will start automatically)
		await this.start()

		// Create a POST request to the container's HTTP server
		const request = new Request(`http://localhost:${this.defaultPort}/`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				// The HTTP server will read from environment variables
				// This body can be empty or contain additional options
			}),
		})

		console.log(`🤖 Sending request to container HTTP server`)

		// Forward request to the container and return the response
		return await this.containerFetch(request)
	}

	/**
	 * Handle incoming requests - forwards to the HTTP server in the container
	 */
	async fetch(request: Request): Promise<Response> {
		try {
			console.log(`🤖 Claude Code Container processing request: ${request.method} ${request.url}`)

			// Forward the request to the containerFetch method
			// The HTTP server inside the container will handle the actual processing
			return await this.containerFetch(request)
		} catch (error) {
			console.error('🤖 Claude Code Container fetch error:', error)

			return new Response(
				JSON.stringify({
					error: 'Container execution failed',
					details: error instanceof Error ? error.message : String(error),
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				}
			)
		}
	}
}
