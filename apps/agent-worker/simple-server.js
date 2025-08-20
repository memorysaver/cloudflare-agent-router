// Simplest possible HTTP server for debugging
console.log('🚀 Starting simple test server...')

const http = require('http')

const server = http.createServer((req, res) => {
	console.log(`📥 ${req.method} ${req.url}`)

	// Set CORS headers
	res.setHeader('Access-Control-Allow-Origin', '*')
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
	res.setHeader('Content-Type', 'application/json')

	if (req.method === 'OPTIONS') {
		res.writeHead(200)
		res.end()
		return
	}

	const response = {
		status: 'working',
		message: 'Simple server is running',
		method: req.method,
		url: req.url,
		env: {
			CLAUDE_PROMPT: process.env.CLAUDE_PROMPT || 'not set',
			ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || 'not set',
			ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || 'not set',
		},
	}

	res.writeHead(200)
	res.end(JSON.stringify(response, null, 2))
})

const port = 3000
server.listen(port, '0.0.0.0', () => {
	console.log(`🚀 Simple server listening on http://0.0.0.0:${port}`)
	console.log(`🚀 Server ready to accept requests`)
})

server.on('error', (error) => {
	console.error('❌ Server error:', error)
	process.exit(1)
})

process.on('uncaughtException', (error) => {
	console.error('❌ Uncaught exception:', error)
	process.exit(1)
})

process.on('unhandledRejection', (reason) => {
	console.error('❌ Unhandled rejection:', reason)
	process.exit(1)
})
