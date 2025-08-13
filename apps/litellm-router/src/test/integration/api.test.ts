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

describe('LiteLLM Health Checks', () => {
	it('comprehensive health check endpoint exists', async () => {
		const res = await SELF.fetch('https://example.com/health/litellm')
		
		// In test environment without container, should return 503 with proper error message
		expect(res.status).toBe(503)
		
		const data = (await res.json()) as { status: string; message: string }
		expect(data.status).toBe('unhealthy')
		expect(data.message).toContain('LiteLLM container is not available')
	})

	it('readiness check endpoint exists', async () => {
		const res = await SELF.fetch('https://example.com/health/readiness')
		
		// In test environment without container, should return 503 with proper error message
		expect(res.status).toBe(503)
		
		const data = (await res.json()) as { status: string; message: string }
		expect(data.status).toBe('not_ready')
		expect(data.message).toContain('LiteLLM container is not configured')
	})

	it('liveliness check endpoint exists', async () => {
		const res = await SELF.fetch('https://example.com/health/liveliness')
		
		// In test environment without container, should return 503 with proper error message
		expect(res.status).toBe(503)
		
		const data = (await res.json()) as { status: string; message: string }
		expect(data.status).toBe('not_alive')
		expect(data.message).toContain('LiteLLM container is not configured')
	})

	it('health endpoints return proper error structure when container unavailable', async () => {
		const endpoints = ['/health/litellm', '/health/readiness', '/health/liveliness']
		
		for (const endpoint of endpoints) {
			const res = await SELF.fetch(`https://example.com${endpoint}`)
			
			expect(res.status).toBe(503)
			expect(res.headers.get('content-type')).toContain('application/json')
			
			const data = (await res.json()) as { status: string; message: string }
			expect(data).toHaveProperty('status')
			expect(data).toHaveProperty('message')
			expect(typeof data.status).toBe('string')
			expect(typeof data.message).toBe('string')
		}
	})
})
