import { Container } from '@cloudflare/containers'

export interface ClaudeCodeOptions {
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
	permissionMode?: "default" | "acceptEdits" | "plan" | "bypassPermissions"  // Default: "default"
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
	 * Execute Claude Code with complete configuration via HTTP server
	 * @param options - Complete Claude Code execution options
	 * @param envVars - Environment variables for API configuration only
	 */
	async executeClaudeCode(
		options: ClaudeCodeOptions,
		envVars: Record<string, string>
	): Promise<Response> {
		// Set environment variables (API configuration only)
		this.envVars = {
			ANTHROPIC_BASE_URL: envVars.ANTHROPIC_BASE_URL,
			ANTHROPIC_AUTH_TOKEN: envVars.ANTHROPIC_AUTH_TOKEN,
			ANTHROPIC_API_KEY: envVars.ANTHROPIC_API_KEY,
		}

		console.log(`🤖 Starting Claude Code container`)
		console.log(`🤖 API Base URL: ${this.envVars.ANTHROPIC_BASE_URL}`)
		console.log(`🤖 Model: ${options.model}`)
		console.log(`🤖 Max Turns: ${options.maxTurns}`)

		// Start the container (HTTP server will start automatically)
		await this.start()

		// Create a POST request with complete options object
		const request = new Request(`http://localhost:${this.defaultPort}/`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(options), // Forward complete options object
		})

		console.log(`🤖 Forwarding complete request to container HTTP server`)

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
