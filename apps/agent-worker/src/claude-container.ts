import { Container } from '@cloudflare/containers'

export interface ClaudeCodeOptions {
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
	 * Execute Claude Code using environment variables (original working pattern)
	 * @param options - Complete Claude Code execution options
	 * @param envVars - Environment variables for API configuration
	 */
	async executeClaudeCode(
		options: ClaudeCodeOptions,
		envVars: Record<string, string>
	): Promise<Response> {
		// ULTRA-SIMPLE: Only LiteLLM configuration in environment variables
		this.envVars = {
			...envVars, // ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN, ANTHROPIC_API_KEY
			ANTHROPIC_MODEL: options.model || 'groq/openai/gpt-oss-120b', // For LiteLLM router
		}

		console.log(`🤖 Starting Claude Code container with ULTRA-SIMPLE env vars`)
		console.log(`🤖 Environment Variables (LiteLLM Configuration Only):`)
		console.log(`  - ANTHROPIC_MODEL: ${this.envVars.ANTHROPIC_MODEL}`)
		console.log(`  - ANTHROPIC_BASE_URL: ${this.envVars.ANTHROPIC_BASE_URL}`)
		console.log(`  - ANTHROPIC_AUTH_TOKEN: ${this.envVars.ANTHROPIC_AUTH_TOKEN}`)

		// Create a POST request to the container's HTTP server with actual request data
		// Note: containerFetch() automatically starts container if needed and renews activity timeout
		const request = new Request(`http://localhost:${this.defaultPort}/`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(options), // Keep request body for compatibility
		})

		console.log(`🤖 Web Request Data Sent to Container:`)
		console.log(`  - Input Format: ${options.inputFormat || 'text'}`)
		console.log(`  - Output Format: ${options.outputFormat || 'json'}`)
		if (options.prompt) {
			console.log(
				`  - Prompt: ${options.prompt.substring(0, 50)}${options.prompt.length > 50 ? '...' : ''}`
			)
		}
		if (options.messages) {
			console.log(`  - Messages: ${options.messages.length} messages`)
		}
		console.log(`  - Model: ${options.model}`)
		console.log(`  - Stream: ${options.stream}`)
		console.log(`  - Verbose: ${options.verbose}`)
		console.log(`  - Max Turns: ${options.maxTurns}`)
		console.log(
			`  - System Prompt: ${options.systemPrompt === '' ? '[Empty - using Claude Code default]' : options.systemPrompt?.substring(0, 30) + '...'}`
		)
		console.log(`  - Permission Mode: ${options.permissionMode}`)
		console.log(`  - Continue Session: ${options.continueSession}`)
		console.log(`  - Resume Session ID: ${options.resumeSessionId || '[None]'}`)
		console.log(`  - Session ID: ${options.sessionId || '[None]'}`)
		console.log(`  - Working Directory (cwd): ${options.cwd || '[Default]'}`)
		console.log(`🤖 Complete Web Request Body:`)
		console.log(JSON.stringify(options, null, 2))
		console.log(`🤖 Forwarding request to container HTTP server`)

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
