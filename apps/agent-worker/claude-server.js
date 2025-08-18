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

// Debug endpoint to check what's in memory
app.get('/debug', (c) => {
  return c.json({
    timestamp: new Date().toISOString(),
    environment: {
      CLAUDE_PROMPT: process.env.CLAUDE_PROMPT,
      ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
      CLAUDE_STREAM: process.env.CLAUDE_STREAM,
      CLAUDE_VERBOSE: process.env.CLAUDE_VERBOSE,
      CLAUDE_MAX_TURNS: process.env.CLAUDE_MAX_TURNS
    },
    processInfo: {
      uptime: process.uptime(),
      pid: process.pid,
      memoryUsage: process.memoryUsage()
    }
  })
})

// Claude Code execution endpoint
app.post('/', async (c) => {
  try {
    console.log('🤖 Claude Code SDK server received request')
    
    // Parse request body to get dynamic parameters
    const requestBody = await c.req.json()
    
    // Use request parameters, fallback to environment variables
    const prompt = requestBody.prompt || process.env.CLAUDE_PROMPT || 'hello'
    const model = requestBody.model || process.env.ANTHROPIC_MODEL || 'openrouter/qwen/qwen3-coder'
    const stream = requestBody.stream !== undefined ? requestBody.stream : (process.env.CLAUDE_STREAM === 'true')
    const verbose = requestBody.verbose !== undefined ? requestBody.verbose : (process.env.CLAUDE_VERBOSE === 'true')
    const maxTurns = requestBody.maxTurns || parseInt(process.env.CLAUDE_MAX_TURNS || '3')
    
    // Generate unique request ID to track this specific request
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    console.log('🤖 Executing Claude Code SDK with prompt:', prompt)
    console.log('🤖 Request ID:', requestId)
    console.log('🤖 Model:', model)
    console.log('🤖 Base URL:', process.env.ANTHROPIC_BASE_URL)
    console.log('🤖 Stream:', stream)
    console.log('🤖 Max Turns:', maxTurns)
    console.log('🤖 Request Body:', JSON.stringify(requestBody, null, 2))
    
    // Configure Claude Code SDK options with unique system prompt to prevent caching
    const options = {
      systemPrompt: `You are a helpful assistant. [Request ID: ${requestId}]`,
      maxTurns: maxTurns,
      // Allow all tools by default
      allowedTools: undefined, // This allows all tools
      permissionMode: 'default',
      cwd: process.cwd(),
      // Force fresh executable for each request to prevent CLI caching
      pathToClaudeCodeExecutable: undefined // Use default but let SDK manage process lifecycle
    }
    
    if (stream) {
      // For streaming responses, we'll use Node.js streaming
      return new Response(
        new ReadableStream({
          async start(controller) {
            try {
              // Force fresh session - no session continuation or resume
              console.log(`🔄 Creating fresh session for streaming query`)
              let sessionId = null
              
              // Create fresh AbortController for this request
              const abortController = new AbortController()
              
              for await (const message of query({ 
                prompt, 
                abortController,
                options: options
              })) {
                console.log('📤 SDK Message type:', message.type)
                
                // Capture session ID from init message
                if (message.type === "system" && message.subtype === "init") {
                  sessionId = message.session_id
                  console.log(`🆔 New session created: ${sessionId}`)
                }
                
                // Log all message content for debugging
                if (message.type === "result") {
                  console.log(`🔍 SDK Result Message:`, JSON.stringify(message, null, 2))
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
                    result: message.result
                  }) + '\n'
                }
                
                if (data) {
                  controller.enqueue(new TextEncoder().encode(data))
                }
              }
              
              console.log('✅ Claude Code SDK execution completed')
              controller.close()
            } catch (error) {
              console.error('❌ Claude Code SDK streaming error:', error)
              const errorData = JSON.stringify({
                type: 'error',
                error: error.message
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
      // For non-streaming, collect all messages and return final result
      const messages = []
      
      // Force fresh session - no session continuation or resume
      console.log(`🔄 Creating fresh session for non-streaming query`)
      let sessionId = null
      
      // Create fresh AbortController for this request
      const abortController = new AbortController()
      
      for await (const message of query({ 
        prompt, 
        abortController,
        options: options
      })) {
        console.log('📤 SDK Message type:', message.type)
        
        // Capture session ID from init message
        if (message.type === "system" && message.subtype === "init") {
          sessionId = message.session_id
          console.log(`🆔 New session created: ${sessionId}`)
        }
        
        // Log all message content for debugging
        if (message.type === "result") {
          console.log(`🔍 SDK Result Message:`, JSON.stringify(message, null, 2))
        }
        
        messages.push(message)
      }
      
      // Find the final result
      const result = messages.find(m => m.type === 'result')
      
      console.log('✅ Claude Code SDK execution completed')
      console.log(`🔍 Request: ${requestId}, Session: ${sessionId}, Result: ${result?.result || 'No result found'}`)
      
      return c.json({
        type: 'result',
        result: result?.result || 'No result found',
        sessionId: sessionId, // Include session ID in response
        messages: verbose ? messages : undefined
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