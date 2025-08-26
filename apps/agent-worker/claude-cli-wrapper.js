const { spawn } = require('child_process')
const readline = require('readline')

/**
 * Claude CLI Wrapper - Replaces broken TypeScript SDK with direct CLI execution
 *
 * Fixes session continuity by using working CLI --continue and --resume flags
 * instead of the broken SDK continueSession/resumeSessionId parameters.
 */
class ClaudeCliWrapper {
	constructor() {
		// Map HTTP sessionId to Claude CLI session IDs
		this.sessionMap = new Map()
	}

	/**
	 * Execute Claude CLI with HTTP API parameters
	 * @param {Object} options - HTTP API options
	 * @param {Object} envVars - Environment variables for LiteLLM configuration
	 * @returns {Promise<Response>} - Streaming or non-streaming response
	 */
	async execute(options, envVars) {
		const flags = this.buildCliFlags(options)
		const env = this.buildEnvironment(options, envVars)

		console.log('🤖 Claude CLI Wrapper executing with flags:', flags.join(' '))

		// Determine if streaming based on outputFormat or deprecated stream flag
		const isStreaming =
			options.outputFormat === 'stream-json' ||
			(options.outputFormat === undefined && options.stream)

		if (isStreaming) {
			return this.executeStreaming(flags, env, options.sessionId, options)
		} else {
			return this.executeNonStreaming(flags, env, options.sessionId, options)
		}
	}

	/**
	 * Build CLI flags from HTTP API parameters
	 * @param {Object} options - HTTP API options
	 * @returns {Array<string>} - CLI flags array
	 */
	buildCliFlags(options) {
		const flags = []

		// Non-interactive mode (print response and exit)
		flags.push('-p')

		// Input format configuration
		const inputFormat = options.inputFormat || 'text'
		flags.push('--input-format', inputFormat)

		// Handle different input formats
		if (inputFormat === 'text' && options.prompt) {
			// Text format: add prompt as final argument
			flags.push(options.prompt)
		} else if (inputFormat === 'stream-json' && options.messages) {
			// Stream-JSON format: we'll pipe the messages via stdin
			// Don't add prompt argument for stream-json
		}

		// Session management (key fix for continuity)
		if (options.resumeSessionId) {
			// Direct resume of specific Claude session
			flags.push('--resume', options.resumeSessionId)
		} else if (options.sessionId && this.sessionMap.has(options.sessionId)) {
			// Resume using mapped Claude session ID
			const claudeSessionId = this.sessionMap.get(options.sessionId)
			flags.push('--resume', claudeSessionId)
		} else if (options.continueSession) {
			// Continue most recent session
			flags.push('--continue')
		}
		// No additional flags = new session

		// Core parameters
		if (options.maxTurns) {
			flags.push('--max-turns', options.maxTurns.toString())
		}

		// Handle system prompt - different from append-system-prompt
		if (options.systemPrompt !== undefined) {
			// For now, Claude CLI only supports --append-system-prompt, not --system-prompt
			// So we'll use append-system-prompt for both cases
			if (options.systemPrompt) {
				flags.push('--append-system-prompt', options.systemPrompt)
			}
		}

		if (options.appendSystemPrompt) {
			flags.push('--append-system-prompt', options.appendSystemPrompt)
		}

		if (options.verbose) {
			flags.push('--verbose')
		}

		if (options.permissionMode) {
			flags.push('--permission-mode', options.permissionMode)
		}

		// Note: Claude CLI doesn't support --cwd flag, working directory is set via spawn options

		// Tool management
		if (options.allowedTools && options.allowedTools.length > 0) {
			flags.push('--allowedTools', options.allowedTools.join(','))
		}

		if (options.disallowedTools && options.disallowedTools.length > 0) {
			flags.push('--disallowedTools', options.disallowedTools.join(','))
		}

		// MCP configuration - handle JSON object by creating .mcp.json file
		if (options.mcpConfig) {
			// The mcpConfig will be handled during execution to create .mcp.json file
			flags.push('--mcp-config', '.mcp.json')
		}

		if (options.permissionPromptTool) {
			flags.push('--permission-prompt-tool', options.permissionPromptTool)
		}

		// Output format (prefer outputFormat over deprecated stream flag)
		let outputFormat = 'json' // default
		if (options.outputFormat) {
			outputFormat = options.outputFormat
		} else if (options.stream) {
			outputFormat = 'stream-json'
		}
		flags.push('--output-format', outputFormat)
		
		// Claude CLI requirement: --print mode with --output-format=stream-json requires --verbose
		if (outputFormat === 'stream-json' && !options.verbose) {
			console.log('🚀 STREAMING: Auto-enabling --verbose for stream-json output format')
			flags.push('--verbose')
		}

		return flags
	}

	/**
	 * Build environment variables for CLI execution
	 * @param {Object} options - HTTP API options
	 * @param {Object} envVars - Base environment variables
	 * @returns {Object} - Complete environment object
	 */
	buildEnvironment(options, envVars) {
		return {
			...process.env,
			// LiteLLM configuration
			ANTHROPIC_BASE_URL: envVars.ANTHROPIC_BASE_URL,
			ANTHROPIC_AUTH_TOKEN: envVars.ANTHROPIC_AUTH_TOKEN,
			ANTHROPIC_API_KEY: envVars.ANTHROPIC_API_KEY,
			// Model configuration
			ANTHROPIC_MODEL: options.model || 'groq/openai/gpt-oss-120b',
			// Working directory
			PWD: options.cwd || '/workspace',
		}
	}

	/**
	 * Execute CLI with streaming response
	 * @param {Array<string>} flags - CLI flags
	 * @param {Object} env - Environment variables
	 * @param {string} httpSessionId - HTTP session ID for mapping
	 * @returns {Promise<Response>} - Streaming Response
	 */
	async executeStreaming(flags, env, httpSessionId, options) {
		const self = this // Capture correct 'this' reference for use inside ReadableStream
		
		console.log('🚀 STREAMING: Starting executeStreaming method')
		console.log('🚀 STREAMING: Flags:', flags.join(' '))
		console.log('🚀 STREAMING: Environment PWD:', env.PWD)
		console.log('🚀 STREAMING: HTTP Session ID:', httpSessionId)
		console.log('🚀 STREAMING: Options:', JSON.stringify(options, null, 2))
		
		return new Response(
			new ReadableStream({
				async start(controller) {
					console.log('🚀 STREAMING: ReadableStream start() called')
					let controllerClosed = false
					try {
						let capturedSessionId = null
						let finalResultMessage = null

						// Prepare stdin data for stream-json input
						let stdinData = null
						if (options && options.inputFormat === 'stream-json' && options.messages) {
							// Convert messages to JSONL format for stdin
							const jsonlMessages =
								options.messages
									.map((msg) =>
										JSON.stringify({
											type: 'user',
											message: msg,
										})
									)
									.join('\n') + '\n'
							stdinData = jsonlMessages
							console.log('📨 Stream-JSON input data:', stdinData)
						}

						// Create MCP config file if provided
						if (options && options.mcpConfig) {
							try {
								const fs = require('fs')
								const path = require('path')
								const mcpFilePath = path.join(env.PWD, '.mcp.json')
								fs.writeFileSync(mcpFilePath, JSON.stringify(options.mcpConfig, null, 2))
								console.log('📝 Created MCP config file:', mcpFilePath)
							} catch (error) {
								console.error('❌ Failed to create MCP config file:', error)
							}
						}

						console.log('🚀 STREAMING: About to spawn claude CLI process')
						console.log('🚀 STREAMING: Command: claude', flags.join(' '))
						console.log('🚀 STREAMING: Working directory:', env.PWD)
						console.log('🚀 STREAMING: Environment variables:')
						Object.keys(env).forEach(key => {
							if (key.includes('ANTHROPIC') || key === 'PWD') {
								console.log(`  ${key}: ${env[key]}`)
							}
						})

						const claudeProcess = spawn('claude', flags, {
							env,
							stdio: [stdinData ? 'pipe' : 'ignore', 'pipe', 'pipe'],
							cwd: env.PWD,
						})

						console.log('🚀 STREAMING: Claude process spawned, PID:', claudeProcess.pid)

						// Handle stdin data for stream-json input
						if (stdinData && claudeProcess.stdin) {
							console.log('🚀 STREAMING: Writing stdin data to process')
							claudeProcess.stdin.write(stdinData)
							claudeProcess.stdin.end()
							console.log('🚀 STREAMING: Stdin data written and closed')
						} else {
							console.log('🚀 STREAMING: No stdin data to write')
						}

						// Handle process errors
						claudeProcess.on('error', (error) => {
							console.error('🚀 STREAMING: ❌ Claude CLI spawn error:', error)
							console.error('🚀 STREAMING: Error type:', error.constructor.name)
							console.error('🚀 STREAMING: Error code:', error.code)
							console.error('🚀 STREAMING: Error message:', error.message)
							if (!controllerClosed) {
								const errorData =
									JSON.stringify({
										type: 'error',
										error: 'CLI execution failed',
										message: error.message,
									}) + '\n'
								controller.enqueue(new TextEncoder().encode(errorData))
								controller.close()
								controllerClosed = true
							}
						})

						// Handle unexpected process exit
						claudeProcess.on('close', (code) => {
							console.log(`🚀 STREAMING: Claude CLI process closed with code: ${code}`)
							if (!controllerClosed) {
								if (code !== 0) {
									console.error(`🚀 STREAMING: ❌ Claude CLI exited with non-zero code: ${code}`)
									const errorData =
										JSON.stringify({
											type: 'error',
											error: 'CLI execution failed',
											message: `Claude CLI exited with code ${code}`,
										}) + '\n'
									controller.enqueue(new TextEncoder().encode(errorData))
								} else {
									console.log('🚀 STREAMING: ✅ Claude CLI process completed successfully')
								}
								controller.close()
								controllerClosed = true
							}
						})

						// Parse streaming JSON output line by line
						console.log('🚀 STREAMING: Creating readline interface for stdout')
						const rl = readline.createInterface({
							input: claudeProcess.stdout,
						})

						console.log('🚀 STREAMING: Setting up readline event handlers')
						rl.on('line', (line) => {
							console.log('🚀 STREAMING: Received line from stdout:', line.substring(0, 100) + (line.length > 100 ? '...' : ''))
							if (!line.trim()) {
								console.log('🚀 STREAMING: Skipping empty line')
								return
							}

							try {
								const message = JSON.parse(line)
								console.log('📤 CLI Message:', message.type, message.subtype || '')

								// Capture session ID for mapping from system init or final result
								if (message.type === 'system' && message.subtype === 'init') {
									capturedSessionId = message.session_id
									console.log(`🆔 Captured Session ID: ${capturedSessionId}`)

									// Store mapping if HTTP sessionId provided
									if (httpSessionId) {
										self.sessionMap.set(httpSessionId, capturedSessionId)
										console.log(`🗂️ Mapped ${httpSessionId} → ${capturedSessionId}`)
									}
								} else if (message.type === 'result' && message.session_id) {
									// Also capture from final result (official location)
									capturedSessionId = message.session_id
									if (httpSessionId) {
										self.sessionMap.set(httpSessionId, message.session_id)
										console.log(`🗂️ Updated mapping ${httpSessionId} → ${message.session_id}`)
									}
									finalResultMessage = message
								}

								// Pass through all messages unchanged (original Claude CLI stream-json format)
								const data = line + '\n'
								controller.enqueue(new TextEncoder().encode(data))
							} catch (error) {
								console.error('🚀 STREAMING: ❌ Failed to parse CLI JSON line:', line, error)
								// Still stream the raw line even if JSON parsing fails
								const data = line + '\n'
								controller.enqueue(new TextEncoder().encode(data))
							}
						})

						rl.on('close', () => {
							console.log('🚀 STREAMING: ✅ Readline interface closed - CLI streaming completed')
							if (!controllerClosed) {
								controller.close()
								controllerClosed = true
							}
						})

						// Add stderr logging
						claudeProcess.stderr.on('data', (data) => {
							console.error('🚀 STREAMING: STDERR:', data.toString())
						})
						
						console.log('🚀 STREAMING: All event handlers set up, waiting for claude CLI output...')
					} catch (error) {
						console.error('🚀 STREAMING: ❌ CLI streaming setup error:', error)
						const errorData =
							JSON.stringify({
								type: 'result',
								subtype: 'error',
								total_cost_usd: 0,
								is_error: true,
								duration_ms: 0,
								duration_api_ms: 0,
								num_turns: 0,
								result: `Streaming execution failed: ${error.message}`,
								session_id: null,
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
	}

	/**
	 * Execute CLI with non-streaming response
	 * @param {Array<string>} flags - CLI flags
	 * @param {Object} env - Environment variables
	 * @param {string} httpSessionId - HTTP session ID for mapping
	 * @returns {Promise<Response>} - JSON Response
	 */
	async executeNonStreaming(flags, env, httpSessionId, options) {
		try {
			// Prepare stdin data for stream-json input
			let stdinData = null
			if (options && options.inputFormat === 'stream-json' && options.messages) {
				// Convert messages to JSONL format for stdin
				const jsonlMessages =
					options.messages
						.map((msg) =>
							JSON.stringify({
								type: 'user',
								message: msg,
							})
						)
						.join('\n') + '\n'
				stdinData = jsonlMessages
				console.log('📨 Stream-JSON input data:', stdinData)
			}

			const result = await this.withTimeout(
				this.spawnClaudeProcess(flags, env, stdinData, options),
				120000 // 2 minute timeout
			)

			let finalSdkResponse = null

			// Parse all CLI output lines to find the final SDK response
			const lines = result.stdout.trim().split('\n')
			for (const line of lines) {
				if (!line.trim()) continue

				try {
					const message = JSON.parse(line)

					// The final result message contains the complete SDK response format
					if (message.type === 'result') {
						finalSdkResponse = message

						// Store session mapping if HTTP sessionId provided
						if (httpSessionId && message.session_id) {
							this.sessionMap.set(httpSessionId, message.session_id)
							console.log(`🗂️ Mapped ${httpSessionId} → ${message.session_id}`)
						}
					}
				} catch (error) {
					console.error('❌ Failed to parse CLI JSON line:', line, error)
				}
			}

			console.log('✅ CLI non-streaming completed')

			// Return the complete SDK response format or create a fallback
			if (finalSdkResponse) {
				return new Response(JSON.stringify(finalSdkResponse), {
					headers: { 'Content-Type': 'application/json' },
				})
			} else {
				// Fallback response matching SDK format
				return new Response(
					JSON.stringify({
						type: 'result',
						subtype: 'error',
						total_cost_usd: 0,
						is_error: true,
						duration_ms: 0,
						duration_api_ms: 0,
						num_turns: 0,
						result: 'No result found in CLI output',
						session_id: null,
					}),
					{
						status: 500,
						headers: { 'Content-Type': 'application/json' },
					}
				)
			}
		} catch (error) {
			console.error('❌ CLI non-streaming error:', error)
			return new Response(
				JSON.stringify({
					type: 'result',
					subtype: 'error',
					total_cost_usd: 0,
					is_error: true,
					duration_ms: 0,
					duration_api_ms: 0,
					num_turns: 0,
					result: `CLI execution failed: ${error.message}`,
					session_id: null,
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				}
			)
		}
	}

	/**
	 * Spawn Claude CLI process and collect output
	 * @param {Array<string>} flags - CLI flags
	 * @param {Object} env - Environment variables
	 * @param {string} stdinData - Data to write to stdin
	 * @param {Object} options - Original options for MCP config handling
	 * @returns {Promise<Object>} - { stdout, stderr, code }
	 */
	spawnClaudeProcess(flags, env, stdinData = null, options = null) {
		return new Promise((resolve, reject) => {
			let stdout = ''
			let stderr = ''

			// Create MCP config file if provided
			if (options && options.mcpConfig) {
				try {
					const fs = require('fs')
					const path = require('path')
					const mcpFilePath = path.join(env.PWD, '.mcp.json')
					fs.writeFileSync(mcpFilePath, JSON.stringify(options.mcpConfig, null, 2))
					console.log('📝 Created MCP config file:', mcpFilePath)
				} catch (error) {
					console.error('❌ Failed to create MCP config file:', error)
				}
			}

			const claudeProcess = spawn('claude', flags, {
				env,
				stdio: [stdinData ? 'pipe' : 'ignore', 'pipe', 'pipe'],
				cwd: env.PWD,
			})

			// Handle stdin data for stream-json input
			if (stdinData && claudeProcess.stdin) {
				claudeProcess.stdin.write(stdinData)
				claudeProcess.stdin.end()
			}

			claudeProcess.stdout.on('data', (data) => {
				stdout += data.toString()
			})

			claudeProcess.stderr.on('data', (data) => {
				stderr += data.toString()
			})

			claudeProcess.on('error', (error) => {
				reject(new Error(`Claude CLI spawn error: ${error.message}`))
			})

			claudeProcess.on('close', (code) => {
				if (code === 0) {
					resolve({ stdout, stderr, code })
				} else {
					reject(new Error(`Claude CLI failed with code ${code}: ${stderr}`))
				}
			})
		})
	}

	/**
	 * Add timeout to promise
	 * @param {Promise} promise - Promise to wrap
	 * @param {number} timeoutMs - Timeout in milliseconds
	 * @returns {Promise} - Promise with timeout
	 */
	withTimeout(promise, timeoutMs) {
		return Promise.race([
			promise,
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error('Claude CLI timeout')), timeoutMs)
			),
		])
	}
}

module.exports = { ClaudeCliWrapper }
