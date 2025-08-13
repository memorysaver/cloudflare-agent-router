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
			keys: {
				openrouter_available: !!c.env.OPENROUTER_API_KEY,
				openrouter_length: c.env.OPENROUTER_API_KEY?.length || 0,
				anthropic_available: !!c.env.ANTHROPIC_API_KEY,
				groq_available: !!c.env.GROQ_API_KEY,
			}
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

			// For LiteLLM requests, inject the API key directly into the request body
			let modifiedRequest = c.req.raw
			
			if (c.req.path.includes('/v1/chat/completions') || c.req.path.includes('/v1/completions')) {
				try {
					// Parse the request body to inject API key
					const requestBody = await c.req.json()
					const model = requestBody.model || ''
					
					console.log(`Worker: Processing ${model} request, injecting API key`)
					
					// Determine which API key to use based on model
					let apiKey = null
					if (model.startsWith('openrouter/')) {
						apiKey = c.env.OPENROUTER_API_KEY
						console.log('Worker: Using OPENROUTER_API_KEY')
					} else if (model.startsWith('anthropic/')) {
						apiKey = c.env.ANTHROPIC_API_KEY
						console.log('Worker: Using ANTHROPIC_API_KEY')
					} else if (model.startsWith('groq/')) {
						apiKey = c.env.GROQ_API_KEY
						console.log('Worker: Using GROQ_API_KEY')
					} else if (model.startsWith('cerebras/')) {
						apiKey = c.env.CEREBRAS_API_KEY
						console.log('Worker: Using CEREBRAS_API_KEY')
					} else if (model.startsWith('openai/') || model.startsWith('gpt-')) {
						apiKey = c.env.OPENAI_API_KEY
						console.log('Worker: Using OPENAI_API_KEY')
					}
					
					// Add api_key to the request if we have one
					if (apiKey) {
						requestBody.api_key = apiKey
						console.log('Worker: API key injected into request body')
					}
					
					// Create new request with modified body
					modifiedRequest = new Request(c.req.raw.url, {
						method: c.req.raw.method,
						headers: c.req.raw.headers,
						body: JSON.stringify(requestBody),
					})
				} catch (error) {
					console.error('Worker: Error modifying request body:', error)
					// Fall back to original request if parsing fails
				}
			}

			// Forward the request to LiteLLM container
			const response = await container.fetch(modifiedRequest)

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