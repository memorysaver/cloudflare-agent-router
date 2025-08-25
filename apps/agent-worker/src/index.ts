import { Hono } from 'hono'
import { useWorkersLogger } from 'workers-tagged-logger'

import { useNotFound, useOnError } from '@repo/hono-helpers'

import { ClaudeCodeAgent } from './agents/claude-code-agent'
import { ClaudeCodeContainer } from './claude-container'
import { handleAgentMessage, handleAgentWebSocket } from './handlers/claude-agent'
import { handleClaudeCode } from './handlers/claude-code'
import { handleDemo, handleDemoHealth } from './handlers/demo'

import type { App } from './context'

const app = new Hono<App>()
	.use(
		'*',
		// middleware
		(c, next) =>
			useWorkersLogger(c.env.NAME, {
				environment: c.env.ENVIRONMENT,
				release: c.env.SENTRY_RELEASE,
			})(c, next)
	)

	.onError(useOnError())
	.notFound(useNotFound())

	.get('/', async (c) => {
		return c.text('hello, world!')
	})

	// Claude Code REST API endpoint (existing)
	.post('/claude-code', handleClaudeCode)

	// Claude Code Agent Framework endpoints (new)
	.get('/demo', handleDemo)
	.get('/demo/', handleDemo) // Handle trailing slash for better UX
	.get('/demo/health', handleDemoHealth) // Must be before parameterized route
	.get('/demo/:sessionId', handleDemo)
	.get('/demo/ws/:sessionId', handleAgentWebSocket)
	.post('/agent/message', handleAgentMessage)

// Export the container and agent classes for Durable Objects
export { ClaudeCodeContainer, ClaudeCodeAgent }

export default app
