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
			modes: {
				premium_available: !!c.env.CLOUDFLARE_AGENT_ROUTER_API_KEY,
				byok_supported: true,
				description:
					'Premium mode: Use router key for internal API keys. BYOK mode: Use your own provider keys.',
			},
			internal_keys: {
				openrouter_available: !!c.env.OPENROUTER_API_KEY,
				openrouter_length: c.env.OPENROUTER_API_KEY?.length || 0,
				anthropic_available: !!c.env.ANTHROPIC_API_KEY,
				groq_available: !!c.env.GROQ_API_KEY,
				cerebras_available: !!c.env.CEREBRAS_API_KEY,
				openai_available: !!c.env.OPENAI_API_KEY,
			},
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

			// Extract token from Authorization header
			const authHeader = c.req.header('Authorization')
			const providedToken = authHeader?.replace('Bearer ', '')

			// Check authentication
			if (!providedToken) {
				return c.json(
					{ error: 'Authorization required', message: 'Provide Authorization: Bearer <token>' },
					401
				)
			}

			// Get container instance
			const id = c.env.LITELLM_CONTAINER.idFromName('litellm-instance')
			const container = c.env.LITELLM_CONTAINER.get(id)

			// For LiteLLM requests, handle authentication and API key injection
			let modifiedRequest = c.req.raw

			if (c.req.path.includes('/v1/chat/completions') || c.req.path.includes('/v1/completions')) {
				try {
					// Parse the request body
					const requestBody = await c.req.json()
					const model = requestBody.model || ''

					// Check if this is premium mode (router key) vs BYOK mode
					if (providedToken === c.env.CLOUDFLARE_AGENT_ROUTER_API_KEY) {
						// Premium Mode: Use internal API keys
						console.log(`Worker: Premium mode - Processing ${model} request with internal keys`)

						// Determine which internal API key to use based on model
						let apiKey = null
						if (model.startsWith('openrouter/')) {
							apiKey = c.env.OPENROUTER_API_KEY
							console.log('Worker: Using internal OPENROUTER_API_KEY')
						} else if (model.startsWith('anthropic/')) {
							apiKey = c.env.ANTHROPIC_API_KEY
							console.log('Worker: Using internal ANTHROPIC_API_KEY')
						} else if (model.startsWith('groq/')) {
							apiKey = c.env.GROQ_API_KEY
							console.log('Worker: Using internal GROQ_API_KEY')
						} else if (model.startsWith('cerebras/')) {
							apiKey = c.env.CEREBRAS_API_KEY
							console.log('Worker: Using internal CEREBRAS_API_KEY')
						} else if (model.startsWith('openai/') || model.startsWith('gpt-')) {
							apiKey = c.env.OPENAI_API_KEY
							console.log('Worker: Using internal OPENAI_API_KEY')
						}

						// Inject internal API key if we have one
						if (apiKey) {
							requestBody.api_key = apiKey
							console.log('Worker: Internal API key injected for premium mode')
						}
					} else {
						// BYOK Mode: Pass through user's provider key
						console.log(`Worker: BYOK mode - Processing ${model} request with user-provided key`)
						requestBody.api_key = providedToken
						console.log('Worker: User-provided API key passed through for BYOK mode')
					}

					// Create new request with modified body
					modifiedRequest = new Request(c.req.raw.url, {
						method: c.req.raw.method,
						headers: c.req.raw.headers,
						body: JSON.stringify(requestBody),
					})
				} catch (error) {
					console.error('Worker: Error processing request body:', error)
					return c.json({ error: 'Invalid request body', details: String(error) }, 400)
				}
			} else {
				// For non-completion requests, just pass through with LiteLLM master key
				// This maintains compatibility with existing health checks and model listings
				const headers = new Headers(c.req.raw.headers)
				headers.set('Authorization', `Bearer ${c.env.LITELLM_MASTER_KEY}`)

				modifiedRequest = new Request(c.req.raw.url, {
					method: c.req.raw.method,
					headers,
					body: c.req.raw.body,
				})
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
