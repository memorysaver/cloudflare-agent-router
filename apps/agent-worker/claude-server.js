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

// Claude Code execution endpoint
app.post('/', async (c) => {
  try {
    console.log('🤖 Claude Code SDK server received request')
    
    // Get parameters from environment variables (set by container)
    const prompt = process.env.CLAUDE_PROMPT || 'hello'
    const model = process.env.ANTHROPIC_MODEL || 'openrouter/qwen/qwen3-coder'
    const stream = process.env.CLAUDE_STREAM === 'true'
    const verbose = process.env.CLAUDE_VERBOSE === 'true'
    const maxTurns = parseInt(process.env.CLAUDE_MAX_TURNS || '1')
    
    console.log('🤖 Executing Claude Code SDK with prompt:', prompt.substring(0, 50) + '...')
    console.log('🤖 Model:', model)
    console.log('🤖 Base URL:', process.env.ANTHROPIC_BASE_URL)
    console.log('🤖 Stream:', stream)
    console.log('🤖 Max Turns:', maxTurns)
    
    // Configure Claude Code SDK options
    const options = {
      systemPrompt: 'You are a helpful assistant.',
      maxTurns: maxTurns,
      // Allow all tools by default
      allowedTools: undefined, // This allows all tools
      permissionMode: 'default'
    }
    
    if (stream) {
      // For streaming responses, we'll use Node.js streaming
      return new Response(
        new ReadableStream({
          async start(controller) {
            try {
              for await (const message of query({ prompt, options })) {
                console.log('📤 SDK Message type:', message.type)
                
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
      
      for await (const message of query({ prompt, options })) {
        console.log('📤 SDK Message type:', message.type)
        messages.push(message)
      }
      
      // Find the final result
      const result = messages.find(m => m.type === 'result')
      
      console.log('✅ Claude Code SDK execution completed')
      
      return c.json({
        type: 'result',
        result: result?.result || 'No result found',
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