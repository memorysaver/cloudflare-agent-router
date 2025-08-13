import { Hono } from 'hono'
import { useWorkersLogger } from 'workers-tagged-logger'

import { useNotFound, useOnError } from '@repo/hono-helpers'

import { LiteLLMContainer } from './container'

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

	// Worker health check (minimal infrastructure monitoring)
	.get('/worker-health', (c) => {
		return c.json({
			status: 'healthy',
			service: 'LiteLLM Router',
			version: '1.0.0',
		})
	})

	// Everything else goes to LiteLLM container
	.all('*', async (c) => {
		try {
			if (!c.env.LITELLM_CONTAINER) {
				return c.json(
					{
						error: 'Container not configured',
						message: 'LiteLLM container is not available. This is a development/testing mode.',
					},
					503
				)
			}

			// Get container instance
			const id = c.env.LITELLM_CONTAINER.idFromName('litellm-instance')
			const container = c.env.LITELLM_CONTAINER.get(id)

			// Forward the request to LiteLLM container
			const response = await container.fetch(c.req.raw)

			return response
		} catch (error) {
			console.error('LiteLLM proxy failed:', error)
			return c.json({ error: 'LiteLLM proxy failed', details: String(error) }, 500)
		}
	})

// Export the container class for Durable Objects
export { LiteLLMContainer }

// Export the main app
export default app