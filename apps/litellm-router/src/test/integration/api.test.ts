import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

describe('LiteLLM Router API', () => {
	it('health check responds correctly', async () => {
		const res = await SELF.fetch('https://example.com/')
		expect(res.status).toBe(200)

		const data = await res.json()
		expect(data).toEqual({
			status: 'healthy',
			service: 'LiteLLM Router',
			version: '1.0.0',
		})
	})

	it('health endpoint responds correctly', async () => {
		const res = await SELF.fetch('https://example.com/health')
		expect(res.status).toBe(200)

		const data = (await res.json()) as { status: string }
		expect(data.status).toBe('healthy')
	})

	it('lists available models endpoint exists', async () => {
		const res = await SELF.fetch('https://example.com/v1/models')
		// Note: This will return 503 in tests since the container is not configured
		// But we can test that the endpoint is routed correctly
		expect([200, 500, 503]).toContain(res.status) // Either success or expected container error
	})

	it('chat completions endpoint exists', async () => {
		const res = await SELF.fetch('https://example.com/v1/chat/completions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model: 'gpt-3.5-turbo',
				messages: [{ role: 'user', content: 'Hello' }],
			}),
		})

		// Note: This will return 503 in tests since the container is not configured
		// But we can test that the endpoint is routed correctly
		expect([200, 500, 503]).toContain(res.status) // Either success or expected container error
	})

	it('completions endpoint exists', async () => {
		const res = await SELF.fetch('https://example.com/v1/completions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model: 'gpt-3.5-turbo',
				prompt: 'Hello world',
				max_tokens: 5,
			}),
		})

		// Note: This will return 503 in tests since the container is not configured
		// But we can test that the endpoint is routed correctly
		expect([200, 500, 503]).toContain(res.status) // Either success or expected container error
	})

	it('embeddings endpoint exists', async () => {
		const res = await SELF.fetch('https://example.com/v1/embeddings', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model: 'text-embedding-ada-002',
				input: 'Hello world',
			}),
		})

		// Note: This will return 503 in tests since the container is not configured
		// But we can test that the endpoint is routed correctly
		expect([200, 500, 503]).toContain(res.status) // Either success or expected container error
	})

	it('returns 404 for non-existent endpoints', async () => {
		const res = await SELF.fetch('https://example.com/non-existent')
		expect(res.status).toBe(404)
	})
})
