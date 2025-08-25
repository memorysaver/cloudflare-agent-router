import { Hono } from 'hono'
import { useWorkersLogger } from 'workers-tagged-logger'

import { useNotFound, useOnError } from '@repo/hono-helpers'

import { ClaudeCodeContainer } from './claude-container'
import { ClaudeCodeAgent } from './agents/claude-code-agent'
import { handleClaudeCode } from './handlers/claude-code'
import { handleAgentWebSocket, handleAgentMessage } from './handlers/claude-agent'
import { handleDemo } from './handlers/demo'

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
	.get('/demo/ws', handleAgentWebSocket)
	.post('/agent/message', handleAgentMessage)

// Export the container and agent classes for Durable Objects
export { ClaudeCodeContainer, ClaudeCodeAgent }

export default app
