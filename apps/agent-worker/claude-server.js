// Log startup process
console.log('🚀 Starting Claude Code SDK server...')

const { Hono } = require('hono')
const { serve } = require('@hono/node-server')

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

// Health check endpoint
app.get('/', (c) => {
  return c.json({ 
    status: 'healthy', 
    service: 'claude-code-container',
    timestamp: new Date().toISOString()
  })
})

// Debug endpoint to check API configuration
app.get('/debug', (c) => {
  return c.json({
    timestamp: new Date().toISOString(),
    apiConfiguration: {
      ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
      ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? '[REDACTED]' : undefined
    },
    processInfo: {
      uptime: process.uptime(),
      pid: process.pid,
      memoryUsage: process.memoryUsage()
    }
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
    
    // Extract request parameters (all from request body - no fallbacks)
    const {
      prompt,
      model,
      stream,
      verbose,
      maxTurns,
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
      additionalArgs
    } = requestBody
    
    // Validate required parameters
    if (!prompt) {
      throw new Error('Missing required parameter: prompt')
    }
    
    console.log('🤖 Extracted Parameters:')
    console.log('  - Prompt:', prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''))
    console.log('  - Model:', model)
    console.log('  - Stream:', stream)
    console.log('  - Max Turns:', maxTurns)
    console.log('  - System Prompt:', systemPrompt === '' ? '[EMPTY - Using Claude Code default]' : systemPrompt)
    console.log('  - Permission Mode:', permissionMode)
    console.log('  - Allowed Tools:', allowedTools)
    console.log('  - Continue Session:', continueSession)
    console.log('  - Resume Session ID:', resumeSessionId)
    
    // Configure Claude Code SDK options - filter out empty/undefined values
    const options = {}
    
    // Always add systemPrompt (even if empty) to test if that fixes the hanging issue
    if (systemPrompt !== undefined) {
      options.systemPrompt = systemPrompt
    }
    
    // Only add appendSystemPrompt if provided
    if (appendSystemPrompt) {
      options.appendSystemPrompt = appendSystemPrompt
    }
    
    // Always include basic options
    if (maxTurns) options.maxTurns = maxTurns
    if (allowedTools) options.allowedTools = allowedTools
    if (disallowedTools) options.disallowedTools = disallowedTools
    if (permissionMode) options.permissionMode = permissionMode
    if (permissionPromptTool) options.permissionPromptTool = permissionPromptTool
    if (mcpConfig) options.mcpConfig = mcpConfig
    if (cwd) options.cwd = cwd
    if (executable) options.executable = executable
    if (executableArgs || additionalArgs) options.executableArgs = executableArgs || additionalArgs
    if (pathToClaudeCodeExecutable) options.pathToClaudeCodeExecutable = pathToClaudeCodeExecutable
    
    // Set defaults for required options
    if (!options.permissionMode) options.permissionMode = 'default'
    if (!options.cwd) options.cwd = process.cwd()
    
    console.log('🤖 Claude Code SDK Options:')
    console.log(JSON.stringify(options, null, 2))
    
    if (stream) {
      // Streaming response
      console.log('🌊 Starting streaming response')
      return new Response(
        new ReadableStream({
          async start(controller) {
            try {
              let sessionId = null
              
              // Create AbortController for this request
              const abortController = new AbortController()
              
              // Query parameters for Claude Code SDK
              const queryParams = {
                prompt,
                abortController,
                options: {
                  ...options,
                  // Add session management if specified
                  ...(continueSession && { continueSession: true }),
                  ...(resumeSessionId && { resumeSessionId })
                }
              }
              
              console.log('🚀 Starting Claude Code SDK query with parameters:')
              console.log(JSON.stringify(queryParams, null, 2))
              
              for await (const message of query(queryParams)) {
                console.log('📤 SDK Message:', message.type, message.subtype || '')
                
                // Capture session ID from init message
                if (message.type === "system" && message.subtype === "init") {
                  sessionId = message.session_id
                  console.log(`🆔 Session ID: ${sessionId}`)
                }
                
                // Log result messages for debugging
                if (message.type === "result" && verbose) {
                  console.log(`🔍 Result:`, JSON.stringify(message, null, 2))
                }
                
                // Stream different message types
                let data
                if (message.type === 'assistant') {
                  data = JSON.stringify({
                    type: 'assistant',
                    content: message.content
                  }) + '\n'
                } else if (message.type === 'tool_call') {
                  data = JSON.stringify({
                    type: 'tool_call',
                    tool: message.tool,
                    input: message.input
                  }) + '\n'
                } else if (message.type === 'tool_result') {
                  data = JSON.stringify({
                    type: 'tool_result',
                    tool: message.tool,
                    result: message.result
                  }) + '\n'
                } else if (message.type === 'result') {
                  data = JSON.stringify({
                    type: 'result',
                    result: message.result,
                    sessionId: sessionId
                  }) + '\n'
                }
                
                if (data) {
                  controller.enqueue(new TextEncoder().encode(data))
                }
              }
              
              console.log('✅ Streaming completed for request:', requestId)
              controller.close()
            } catch (error) {
              console.error('❌ Streaming error for request:', requestId, error)
              const errorData = JSON.stringify({
                type: 'error',
                error: error.message,
                requestId: requestId
              }) + '\n'
              controller.enqueue(new TextEncoder().encode(errorData))
              controller.close()
            }
          }
        }),
        {
          headers: {
            'Content-Type': 'text/plain',
            'Transfer-Encoding': 'chunked'
          }
        }
      )
    } else {
      // Non-streaming response
      console.log('📝 Starting non-streaming response')
      const messages = []
      let sessionId = null
      
      // Create AbortController for this request
      const abortController = new AbortController()
      
      // Query parameters for Claude Code SDK
      const queryParams = {
        prompt,
        abortController,
        options: {
          ...options,
          // Add session management if specified
          ...(continueSession && { continueSession: true }),
          ...(resumeSessionId && { resumeSessionId })
        }
      }
      
      console.log('🚀 Starting Claude Code SDK query with parameters:')
      console.log(JSON.stringify(queryParams, null, 2))
      
      for await (const message of query(queryParams)) {
        console.log('📤 SDK Message:', message.type, message.subtype || '')
        
        // Capture session ID from init message
        if (message.type === "system" && message.subtype === "init") {
          sessionId = message.session_id
          console.log(`🆔 Session ID: ${sessionId}`)
        }
        
        // Log result messages for debugging
        if (message.type === "result" && verbose) {
          console.log(`🔍 Result:`, JSON.stringify(message, null, 2))
        }
        
        messages.push(message)
      }
      
      // Find the final result
      const result = messages.find(m => m.type === 'result')
      
      console.log('✅ Non-streaming completed for request:', requestId)
      console.log(`🔍 Session: ${sessionId}, Result length: ${result?.result?.length || 0}`)
      
      return c.json({
        type: 'result',
        result: result?.result || 'No result found',
        sessionId: sessionId,
        requestId: requestId,
        messages: verbose ? messages : undefined,
        // Include metadata if available
        ...(result?.total_cost_usd && { cost_usd: result.total_cost_usd }),
        ...(result?.duration_ms && { duration_ms: result.duration_ms })
      })
    }
    
  } catch (error) {
    console.error('❌ Claude Code SDK server error:', error)
    return c.json({
      type: 'error',
      error: error.message,
      details: error.stack
    }, 500)
  }
})

// Handle errors
app.onError((error, c) => {
  console.error('❌ Hono server error:', error)
  return c.json({
    type: 'error',
    error: error.message
  }, 500)
})

// Start the server
const port = 3000
console.log(`🚀 Claude Code SDK server starting on port ${port}`)

try {
  serve({
    fetch: app.fetch,
    port: port,
    hostname: '0.0.0.0'
  }, (info) => {
    console.log(`🚀 Claude Code SDK server listening on http://0.0.0.0:${info.port}`)
    console.log(`🚀 Server ready to accept requests`)
  })
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