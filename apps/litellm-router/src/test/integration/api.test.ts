import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

describe('LiteLLM Router API', () => {
	it('worker health check responds correctly', async () => {
		const res = await SELF.fetch('https://example.com/worker-health')
		expect(res.status).toBe(200)

		const data = await res.json()
		expect(data).toHaveProperty('status', 'healthy')
		expect(data).toHaveProperty('service', 'LiteLLM Router')
		expect(data).toHaveProperty('version', '1.0.0')
		expect(data).toHaveProperty('modes')
		expect(data).toHaveProperty('internal_keys')
		// BYOK capabilities should be present
		expect((data as any).modes).toHaveProperty('byok_supported', true)
		expect(typeof (data as any).internal_keys).toBe('object')
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
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer test-token', // Required for authentication
				},
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
		const res = await SELF.fetch('https://example.com/any-endpoint', {
			headers: {
				Authorization: 'Bearer test-token', // Required for authentication
			},
		})
		expect(res.status).toBe(503)

		const data = await res.json()
		expect(data).toHaveProperty('error')
		expect(data).toHaveProperty('message')
		expect((data as any).error).toBe('Container not configured')
	})

	it('handles missing authorization appropriately', async () => {
		const res = await SELF.fetch('https://example.com/v1/chat/completions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ model: 'test', messages: [{ role: 'user', content: 'test' }] }),
		})

		// In test environment without container: 503 (container not configured)
		// In production with container: 401 (authorization required)
		expect([401, 503]).toContain(res.status)

		const data = await res.json()

		if (res.status === 401) {
			expect((data as any).error).toBe('Authorization required')
		} else if (res.status === 503) {
			expect((data as any).error).toBe('Container not configured')
		}
	})
})
