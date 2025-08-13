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

	// Health check endpoint
	.get('/', async (c) => {
		return c.json({
			status: 'healthy',
			service: 'LiteLLM Router',
			version: '1.0.0',
		})
	})

	// Health check endpoint (alternative)
	.get('/health', async (c) => {
		try {
			// Optional: ping the container to verify it's running
			return c.json({ status: 'healthy' })
		} catch (error) {
			console.error('Health check failed:', error)
			return c.json({ status: 'unhealthy', error: String(error) }, 503)
		}
	})

	// List available models
	.get('/v1/models', async (c) => {
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

			const container = await getContainer(c)
			const response = await container.containerFetch('/v1/models')

			// Forward the response from LiteLLM
			const data = (await response.json()) as Record<string, unknown>
			return c.json(data)
		} catch (error) {
			console.error('Failed to list models:', error)
			return c.json({ error: 'Failed to list models' }, 500)
		}
	})

	// Chat completions endpoint (OpenAI compatible)
	.post('/v1/chat/completions', async (c) => {
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

			const container = await getContainer(c)

			// Get the request body
			const requestBody = await c.req.text()

			// Forward request to LiteLLM container
			const response = await container.containerFetch('/v1/chat/completions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: c.req.header('Authorization') || '',
				},
				body: requestBody,
			})

			// Check if the response is successful
			if (!response.ok) {
				const errorText = await response.text()
				console.error('LiteLLM error:', errorText)
				return c.json({ error: 'LiteLLM request failed', details: errorText }, 500)
			}

			// Forward the response from LiteLLM
			const data = (await response.json()) as Record<string, unknown>
			return c.json(data)
		} catch (error) {
			console.error('Chat completion failed:', error)
			return c.json({ error: 'Chat completion failed', details: String(error) }, 500)
		}
	})

	// Legacy completions endpoint (OpenAI compatible)
	.post('/v1/completions', async (c) => {
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

			const container = await getContainer(c)

			// Get the request body
			const requestBody = await c.req.text()

			// Forward request to LiteLLM container
			const response = await container.containerFetch('/v1/completions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: c.req.header('Authorization') || '',
				},
				body: requestBody,
			})

			// Check if the response is successful
			if (!response.ok) {
				const errorText = await response.text()
				console.error('LiteLLM error:', errorText)
				return c.json({ error: 'LiteLLM request failed', details: errorText }, 500)
			}

			// Forward the response from LiteLLM
			const data = (await response.json()) as Record<string, unknown>
			return c.json(data)
		} catch (error) {
			console.error('Completion failed:', error)
			return c.json({ error: 'Completion failed', details: String(error) }, 500)
		}
	})

	// Embeddings endpoint (OpenAI compatible)
	.post('/v1/embeddings', async (c) => {
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

			const container = await getContainer(c)

			// Get the request body
			const requestBody = await c.req.text()

			// Forward request to LiteLLM container
			const response = await container.containerFetch('/v1/embeddings', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: c.req.header('Authorization') || '',
				},
				body: requestBody,
			})

			// Check if the response is successful
			if (!response.ok) {
				const errorText = await response.text()
				console.error('LiteLLM error:', errorText)
				return c.json({ error: 'LiteLLM request failed', details: errorText }, 500)
			}

			// Forward the response from LiteLLM
			const data = (await response.json()) as Record<string, unknown>
			return c.json(data)
		} catch (error) {
			console.error('Embeddings failed:', error)
			return c.json({ error: 'Embeddings failed', details: String(error) }, 500)
		}
	})

/**
 * Get or create a LiteLLM container instance
 * Uses a single named instance for simplicity
 */
async function getContainer(c: any): Promise<LiteLLMContainer> {
	if (!c.env.LITELLM_CONTAINER) {
		throw new Error('LITELLM_CONTAINER binding not available')
	}

	// Use a consistent ID for the container instance
	const id = c.env.LITELLM_CONTAINER.idFromName('litellm-instance')
	const stub = c.env.LITELLM_CONTAINER.get(id)

	return stub as LiteLLMContainer
}

// Export the container class for Durable Objects
export { LiteLLMContainer }

// Export the main app
export default app
