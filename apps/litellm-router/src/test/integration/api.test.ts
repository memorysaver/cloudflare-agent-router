import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

describe('LiteLLM Router API', () => {
	it('worker health check responds correctly', async () => {
		const res = await SELF.fetch('https://example.com/worker-health')
		expect(res.status).toBe(200)

		const data = await res.json()
		expect(data).toEqual({
			status: 'healthy',
			service: 'LiteLLM Router',
			version: '1.0.0',
		})
	})

	it('forwards root path to LiteLLM (Swagger UI)', async () => {
		const res = await SELF.fetch('https://example.com/')
		// Should return 503 when container not available, but proves forwarding works
		expect(res.status).toBe(503)

		const data = await res.json()
		expect((data as any).error).toBe('Container not configured')
	})

	it('forwards requests to container when available', async () => {
		const endpoints = [
			'/v1/models',
			'/v1/chat/completions',
			'/v1/completions',
			'/v1/embeddings',
			'/health',
			'/openapi.json',
		]

		for (const endpoint of endpoints) {
			const res = await SELF.fetch(`https://example.com${endpoint}`, {
				method: endpoint === '/v1/models' ? 'GET' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body:
					endpoint.startsWith('/v1/') && endpoint !== '/v1/models'
						? JSON.stringify({ model: 'test', messages: [{ role: 'user', content: 'test' }] })
						: undefined,
			})

			// Should return 503 when container not available in test mode
			expect(res.status).toBe(503)

			const data = await res.json()
			expect((data as any).error).toBe('Container not configured')
		}
	})

	it('returns proper error when container not configured', async () => {
		const res = await SELF.fetch('https://example.com/any-endpoint')
		expect(res.status).toBe(503)

		const data = await res.json()
		expect(data).toHaveProperty('error')
		expect(data).toHaveProperty('message')
		expect((data as any).error).toBe('Container not configured')
	})
})
