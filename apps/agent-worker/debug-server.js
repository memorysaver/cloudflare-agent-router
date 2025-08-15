// Simple debug server to test container setup
console.log('🚀 Starting debug server...')

const { Hono } = require('hono')
const { serve } = require('@hono/node-server')

console.log('📦 Loaded dependencies successfully')

const app = new Hono()

// Health check endpoint
app.get('/', (c) => {
  console.log('📥 Health check request received')
  return c.json({ 
    status: 'healthy', 
    service: 'claude-code-debug-container',
    timestamp: new Date().toISOString(),
    env: {
      CLAUDE_PROMPT: process.env.CLAUDE_PROMPT || 'not set',
      ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || 'not set',
      ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || 'not set'
    }
  })
})

// Test endpoint
app.post('/', async (c) => {
  console.log('📥 POST request received')
  
  return c.json({
    status: 'received',
    message: 'Debug server is working',
    env: {
      CLAUDE_PROMPT: process.env.CLAUDE_PROMPT || 'not set',
      ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || 'not set',
      ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || 'not set'
    }
  })
})

// Start the server
const port = 3000
console.log(`🚀 Debug server starting on port ${port}`)

serve({
  fetch: app.fetch,
  port: port,
  hostname: '0.0.0.0'
}, (info) => {
  console.log(`🚀 Debug server listening on http://0.0.0.0:${info.port}`)
  console.log(`🚀 Server ready to accept requests`)
})