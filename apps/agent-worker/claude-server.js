// Log startup process
console.log('🚀 Starting Claude Code CLI server...')

const { Hono } = require('hono')
const { serve } = require('@hono/node-server')
const fs = require('fs')
const path = require('path')
const { ClaudeCliWrapper } = require('./claude-cli-wrapper')

console.log('📦 Loaded Hono and node-server')

// Initialize Claude CLI Wrapper (replaces broken SDK)
let cliWrapper
try {
	cliWrapper = new ClaudeCliWrapper()
	console.log('📦 Initialized Claude CLI Wrapper successfully')
} catch (error) {
	console.error('❌ Failed to initialize Claude CLI Wrapper:', error.message)
	process.exit(1)
}

const app = new Hono()

// Health check endpoint
app.get('/', (c) => {
	return c.json({
		status: 'healthy',
		service: 'claude-code-container',
		timestamp: new Date().toISOString(),
	})
})

// Debug endpoint to check API configuration
app.get('/debug', (c) => {
	return c.json({
		timestamp: new Date().toISOString(),
		apiConfiguration: {
			ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
			ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
			ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? '[REDACTED]' : undefined,
		},
		processInfo: {
			uptime: process.uptime(),
			pid: process.pid,
			memoryUsage: process.memoryUsage(),
		},
	})
})

// Claude Code execution endpoint - Pure proxy
app.post('/', async (c) => {
	try {
		console.log('🤖 Claude Code SDK proxy received request')

		// Parse complete request body
		const requestBody = await c.req.json()

		// Generate unique request ID for tracking
		const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

		// Detailed request logging for debugging
		console.log('🤖 Request ID:', requestId)
		console.log('🤖 Complete Request Body:')
		console.log(JSON.stringify(requestBody, null, 2))
		console.log('🤖 API Configuration:')
		console.log('  - Base URL:', process.env.ANTHROPIC_BASE_URL)
		console.log('  - Auth Token:', process.env.ANTHROPIC_AUTH_TOKEN)

		// ULTRA-SIMPLE: All request parameters from web request directly
		const prompt = requestBody.prompt || 'hello'
		const model = requestBody.model || process.env.ANTHROPIC_MODEL || 'groq/openai/gpt-oss-120b'
		const stream = requestBody.stream !== undefined ? requestBody.stream : false
		const verbose = requestBody.verbose !== undefined ? requestBody.verbose : false
		const maxTurns = requestBody.maxTurns || 10

		console.log('🤖 ULTRA-SIMPLE: Direct request-to-SDK mapping')
		console.log('🤖 Request ID:', requestId)
		console.log('🤖 Prompt (from request):', prompt)
		console.log('🤖 Model (env fallback):', model)
		console.log('🤖 LiteLLM Base URL:', process.env.ANTHROPIC_BASE_URL)
		console.log('🤖 Stream (from request):', stream)
		console.log('🤖 Max Turns (from request):', maxTurns)
		console.log('🤖 Complete Request Body:', JSON.stringify(requestBody, null, 2))

		// Extract additional parameters from request body for extended functionality
		const {
			sessionId,
			systemPrompt,
			appendSystemPrompt,
			allowedTools,
			disallowedTools,
			continueSession,
			resumeSessionId,
			permissionMode,
			permissionPromptTool,
			mcpConfig,
			cwd,
			executable,
			executableArgs,
			pathToClaudeCodeExecutable,
			additionalArgs,
		} = requestBody

		// Simplified Session Management - Use Shared Workspace
		let sessionWorkspacePath = cwd || '/workspace'
		console.log(`📁 Using shared workspace: ${sessionWorkspacePath}`)

		// Ensure shared workspace directory exists
		const fs = require('fs')
		try {
			fs.mkdirSync(sessionWorkspacePath, { recursive: true })
			console.log(`📁 Shared workspace ready: ${sessionWorkspacePath}`)
		} catch (error) {
			console.warn(`⚠️ Workspace directory creation warning:`, error.message)
		}

		// ULTRA-SIMPLE: Direct request-to-SDK mapping (following official docs pattern)
		const options = {
			prompt: prompt, // Add the missing prompt parameter
			systemPrompt:
				systemPrompt && systemPrompt.trim() !== ''
					? systemPrompt
					: `You are a helpful assistant. [Request ID: ${requestId}]`,
			maxTurns: maxTurns,
			stream: stream,
			sessionId: sessionId,
			// Critical SDK defaults for proper function
			allowedTools: allowedTools || undefined, // undefined = all tools enabled
			permissionMode: permissionMode || 'acceptEdits',
			cwd: sessionWorkspacePath,
			pathToClaudeCodeExecutable: pathToClaudeCodeExecutable || undefined, // undefined = SDK manages
			// Session management - use resumeSessionId if provided, otherwise continueSession
			continueSession: resumeSessionId
				? false
				: continueSession !== undefined
					? continueSession
					: true,
			resumeSessionId: resumeSessionId,
		}

		// Add optional parameters directly from request (no env var fallbacks)
		if (appendSystemPrompt) options.appendSystemPrompt = appendSystemPrompt
		if (disallowedTools) options.disallowedTools = disallowedTools
		if (permissionPromptTool) options.permissionPromptTool = permissionPromptTool
		if (mcpConfig) options.mcpConfig = mcpConfig
		if (executable) options.executable = executable
		if (executableArgs || additionalArgs) options.executableArgs = executableArgs || additionalArgs

		console.log('🤖 Claude CLI Options:')
		console.log(JSON.stringify(options, null, 2))

		// Prepare environment variables (API configuration only)
		const envVars = {
			ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN || 'auto-detect',
			ANTHROPIC_BASE_URL:
				process.env.ANTHROPIC_BASE_URL || 'https://litellm-router.memorysaver.workers.dev',
		}

		// Add optional API key if provided
		if (process.env.ANTHROPIC_API_KEY) {
			envVars.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
		}

		console.log(`🤖 Using LiteLLM router: ${envVars.ANTHROPIC_BASE_URL}`)
		console.log(`🤖 Using model: ${options.model}`)
		console.log(`🤖 Auth mode: ${envVars.ANTHROPIC_AUTH_TOKEN}`)
		console.log(`🤖 Request contains ${Object.keys(requestBody).length} parameters`)

		// Execute using Claude CLI Wrapper (replaces broken SDK)
		console.log(`🤖 Executing Claude CLI Wrapper...`)
		const response = cliWrapper.execute(options, envVars) // No await for streaming!

		// Determine if streaming based on outputFormat or deprecated stream flag
		const isStreaming = 
			options.outputFormat === 'stream-json' ||
			(options.outputFormat === undefined && options.stream)

		if (isStreaming) {
			console.log(`🤖 Returning streaming response immediately (no await)`)
			// Return streaming response immediately - don't await!
			return response
		} else {
			console.log(`🤖 Awaiting non-streaming response completion`)
			// For non-streaming, await the complete response
			const completedResponse = await response
			console.log(`🤖 CLI Wrapper response status: ${completedResponse.status}`)
			return completedResponse
		}
	} catch (error) {
		console.error('❌ Claude CLI Wrapper server error:', error)
		return c.json(
			{
				type: 'error',
				error: error.message,
				details: error.stack,
			},
			500
		)
	}
})

// Handle errors
app.onError((error, c) => {
	console.error('❌ Hono server error:', error)
	return c.json(
		{
			type: 'error',
			error: error.message,
		},
		500
	)
})

// Start the server
const port = 3000
console.log(`🚀 Claude Code SDK server starting on port ${port}`)

try {
	serve(
		{
			fetch: app.fetch,
			port: port,
			hostname: '0.0.0.0',
		},
		(info) => {
			console.log(`🚀 Claude Code SDK server listening on http://0.0.0.0:${info.port}`)
			console.log(`🚀 Server ready to accept requests`)
		}
	)
} catch (error) {
	console.error('❌ Failed to start server:', error)
	process.exit(1)
}

// Handle process errors
process.on('uncaughtException', (error) => {
	console.error('❌ Uncaught exception:', error)
	process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
	console.error('❌ Unhandled rejection at:', promise, 'reason:', reason)
	process.exit(1)
})
