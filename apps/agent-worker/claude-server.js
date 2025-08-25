// Log startup process
console.log('🚀 Starting Claude Code SDK server...')

const { Hono } = require('hono')
const { serve } = require('@hono/node-server')
const fs = require('fs')
const path = require('path')

console.log('📦 Loaded Hono and node-server')

// Try to load Claude Code SDK
let query
try {
	const claudeCode = require('@anthropic-ai/claude-code')
	query = claudeCode.query
	console.log('📦 Loaded Claude Code SDK successfully')
} catch (error) {
	console.error('❌ Failed to load Claude Code SDK:', error.message)
	process.exit(1)
}

const app = new Hono()

// Session folder management
function ensureSessionFolder(sessionId, isTemp = false) {
	const sessionPath = path.join('/sessions', sessionId)
	const workspacePath = path.join(sessionPath, 'workspace')

	try {
		// Create session directory structure
		fs.mkdirSync(sessionPath, { recursive: true })
		fs.mkdirSync(workspacePath, { recursive: true })

		console.log(`📁 Created ${isTemp ? 'temp ' : ''}session folder: ${sessionPath}`)
		return { sessionPath, workspacePath, sessionId }
	} catch (error) {
		console.error(`❌ Failed to create session folder ${sessionPath}:`, error)
		throw error
	}
}

// Generate temp sandbox ID for new sessions
function generateSandboxId() {
	const timestamp = Date.now()
	const random = Math.random().toString(36).substr(2, 9)
	return `temp_${timestamp}_${random}`
}

// Rename session folder from sandbox ID to actual session ID
function renameSessionFolder(fromSandboxId, toSessionId) {
	const fromPath = path.join('/sessions', fromSandboxId)
	const toPath = path.join('/sessions', toSessionId)

	try {
		// Check if source folder exists
		if (!fs.existsSync(fromPath)) {
			console.warn(`⚠️ Source folder not found for rename: ${fromPath}`)
			return false
		}

		// Check if target folder already exists
		if (fs.existsSync(toPath)) {
			console.warn(`⚠️ Target folder already exists: ${toPath}`)
			return false
		}

		// Perform atomic rename
		fs.renameSync(fromPath, toPath)
		console.log(`✅ Renamed session folder: ${fromSandboxId} → ${toSessionId}`)
		return true
	} catch (error) {
		console.error(`❌ Failed to rename session folder ${fromSandboxId} → ${toSessionId}:`, error)

		// Fallback: Create symlink if rename fails
		try {
			fs.symlinkSync(fromPath, toPath, 'dir')
			console.log(`🔗 Created symlink fallback: ${fromSandboxId} → ${toSessionId}`)
			return true
		} catch (symlinkError) {
			console.error(`❌ Symlink fallback failed:`, symlinkError)
			return false
		}
	}
}

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
			systemPrompt:
				systemPrompt && systemPrompt.trim() !== ''
					? systemPrompt
					: `You are a helpful assistant. [Request ID: ${requestId}]`,
			maxTurns: maxTurns,
			// Critical SDK defaults for proper function
			allowedTools: allowedTools || undefined, // undefined = all tools enabled
			permissionMode: permissionMode || 'acceptEdits',
			cwd: sessionWorkspacePath,
			pathToClaudeCodeExecutable: pathToClaudeCodeExecutable || undefined, // undefined = SDK manages
			// Simplified session management - always try to continue in shared workspace
			continueSession: continueSession !== false, // Default to true unless explicitly false
		}

		// Add optional parameters directly from request (no env var fallbacks)
		if (appendSystemPrompt) options.appendSystemPrompt = appendSystemPrompt
		if (disallowedTools) options.disallowedTools = disallowedTools
		if (permissionPromptTool) options.permissionPromptTool = permissionPromptTool
		if (mcpConfig) options.mcpConfig = mcpConfig
		if (executable) options.executable = executable
		if (executableArgs || additionalArgs) options.executableArgs = executableArgs || additionalArgs

		console.log('🤖 Claude Code SDK Options:')
		console.log(JSON.stringify(options, null, 2))

		if (stream) {
			// Streaming response
			console.log('🌊 Starting streaming response')
			return new Response(
				new ReadableStream({
					async start(controller) {
						try {
							let capturedSessionId = null // Will be captured from Claude Code SDK
							let finalResultMessage = null // Buffer for final result message

							// Create AbortController for this request
							const abortController = new AbortController()

							// Query parameters for Claude Code SDK
							const queryParams = {
								prompt,
								abortController,
								options: {
									...options,
								},
							}

							console.log('🚀 Starting Claude Code SDK query with parameters:')
							console.log(JSON.stringify(queryParams, null, 2))

							for await (const message of query(queryParams)) {
								console.log('📤 SDK Message:', message.type, message.subtype || '')

								// Capture session ID from init message (don't rename yet)
								if (message.type === 'system' && message.subtype === 'init') {
									capturedSessionId = message.session_id
									console.log(`🆔 Captured Session ID: ${capturedSessionId}`)
								}

								// Log result messages for debugging
								if (message.type === 'result' && verbose) {
									console.log(`🔍 Result:`, JSON.stringify(message, null, 2))
								}

								// Stream different message types (except final result)
								let data
								if (message.type === 'assistant') {
									data =
										JSON.stringify({
											type: 'assistant',
											content: message.content,
										}) + '\n'
								} else if (message.type === 'tool_call') {
									data =
										JSON.stringify({
											type: 'tool_call',
											tool: message.tool,
											input: message.input,
										}) + '\n'
								} else if (message.type === 'tool_result') {
									data =
										JSON.stringify({
											type: 'tool_result',
											tool: message.tool,
											result: message.result,
										}) + '\n'
								} else if (message.type === 'result') {
									// Buffer final result message - don't stream yet
									finalResultMessage = message
									continue // Skip streaming this message
								}

								if (data) {
									controller.enqueue(new TextEncoder().encode(data))
								}
							}

							// SDK completed
							console.log('✅ SDK execution completed')

							// Stream the final result
							if (finalResultMessage) {
								const finalData =
									JSON.stringify({
										type: 'result',
										result: finalResultMessage.result,
										sessionId: capturedSessionId,
									}) + '\n'

								controller.enqueue(new TextEncoder().encode(finalData))
							}

							console.log('✅ Streaming completed for request:', requestId)
							controller.close()
						} catch (error) {
							console.error('❌ Streaming error for request:', requestId, error)
							const errorData =
								JSON.stringify({
									type: 'error',
									error: error.message,
									requestId: requestId,
								}) + '\n'
							controller.enqueue(new TextEncoder().encode(errorData))
							controller.close()
						}
					},
				}),
				{
					headers: {
						'Content-Type': 'text/plain',
						'Transfer-Encoding': 'chunked',
					},
				}
			)
		} else {
			// Non-streaming response
			console.log('📝 Starting non-streaming response')
			const messages = []
			let capturedSessionId = null // Will be captured from Claude Code SDK

			// Create AbortController for this request
			const abortController = new AbortController()

			// Query parameters for Claude Code SDK
			const queryParams = {
				prompt,
				abortController,
				options: {
					...options,
				},
			}

			console.log('🚀 Starting Claude Code SDK query with parameters:')
			console.log(JSON.stringify(queryParams, null, 2))

			for await (const message of query(queryParams)) {
				console.log('📤 SDK Message:', message.type, message.subtype || '')

				// Capture session ID from init message (don't rename yet)
				if (message.type === 'system' && message.subtype === 'init') {
					capturedSessionId = message.session_id
					console.log(`🆔 Captured Session ID: ${capturedSessionId}`)
				}

				// Log result messages for debugging
				if (message.type === 'result' && verbose) {
					console.log(`🔍 Result:`, JSON.stringify(message, null, 2))
				}

				messages.push(message)
			}

			// Find the final result
			const result = messages.find((m) => m.type === 'result')

			console.log('✅ Non-streaming completed for request:', requestId)
			console.log(`🔍 Session: ${capturedSessionId}, Result length: ${result?.result?.length || 0}`)

			return c.json({
				type: 'result',
				result: result?.result || 'No result found',
				sessionId: capturedSessionId,
				requestId: requestId,
				messages: verbose ? messages : undefined,
				// Include metadata if available
				...(result?.total_cost_usd && { cost_usd: result.total_cost_usd }),
				...(result?.duration_ms && { duration_ms: result.duration_ms }),
			})
		}
	} catch (error) {
		console.error('❌ Claude Code SDK server error:', error)
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
