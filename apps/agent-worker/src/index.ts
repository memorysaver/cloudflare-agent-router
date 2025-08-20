import { Hono } from 'hono'
import { useWorkersLogger } from 'workers-tagged-logger'

import { useNotFound, useOnError } from '@repo/hono-helpers'

import { ClaudeCodeContainer } from './claude-container'
import { handleClaudeCode } from './handlers/claude-code'

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

	// Claude Code endpoint
	.post('/claude-code', handleClaudeCode)

// Export the container class for Durable Objects
export { ClaudeCodeContainer }

export default app
