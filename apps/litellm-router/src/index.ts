import { Hono } from 'hono'
import { useWorkersLogger } from 'workers-tagged-logger'

import { useNotFound, useOnError } from '@repo/hono-helpers'

import { LiteLLMContainer } from './container'
import { handleCompletion } from './handlers/completion'
import { handleOtherRequests } from './handlers/proxy'
import { getAvailableProviders } from './utils/provider'
import { isCompletionRequest } from './utils/request'

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

	// Worker health check (simplified infrastructure monitoring)
	.get('/worker-health', (c) => {
		const availableProviders = getAvailableProviders(c.env)

		return c.json({
			status: 'healthy',
			service: 'LiteLLM Router',
			version: '0.2.0',
			description: 'Simplified router: Bring your API key or we auto-detect provider',
			available_providers: availableProviders,
			internal_keys: {
				openrouter_available: !!c.env.OPENROUTER_API_KEY,
				anthropic_available: !!c.env.ANTHROPIC_API_KEY,
				groq_available: !!c.env.GROQ_API_KEY,
				cerebras_available: !!c.env.CEREBRAS_API_KEY,
				openai_available: !!c.env.OPENAI_API_KEY,
				total_configured: availableProviders.length,
			},
		})
	})

	// Route all other requests to appropriate handlers
	.all('*', async (c) => {
		// Check container availability
		if (!c.env.LITELLM_CONTAINER) {
			return c.json(
				{
					error: 'Container not configured',
					message: 'LiteLLM container is not available. This is a development/testing mode.',
				},
				503
			)
		}

		// Route to appropriate handler based on request type
		if (isCompletionRequest(c.req.path)) {
			return handleCompletion(c)
		} else {
			return handleOtherRequests(c)
		}
	})

// Export the container class for Durable Objects
export { LiteLLMContainer }

// Export the main app
export default app
