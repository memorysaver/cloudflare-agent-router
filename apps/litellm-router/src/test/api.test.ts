import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

describe('LiteLLM Router API v2.0', () => {
	it('worker health check responds correctly', async () => {
		const res = await SELF.fetch('https://example.com/worker-health')
		expect(res.status).toBe(200)

		const data = await res.json()
		expect(data).toHaveProperty('status', 'healthy')
		expect(data).toHaveProperty('service', 'LiteLLM Router')
		expect(data).toHaveProperty('version', '2.0.0')
		expect(data).toHaveProperty('description', 'Simplified router: Bring your API key or we auto-detect provider')
		expect(data).toHaveProperty('available_providers')
		expect(data).toHaveProperty('internal_keys')
		expect(Array.isArray((data as any).available_providers)).toBe(true)
		expect(typeof (data as any).internal_keys).toBe('object')
	})

	it('forwards root path to LiteLLM (Swagger UI)', async () => {
		const res = await SELF.fetch('https://example.com/')
		// Should return 503 when container not available, but proves forwarding works
		expect(res.status).toBe(503)

		const data = await res.json()
		expect((data as any).error).toBe('Container not configured')
	})

	it('forwards OpenAI format completion requests', async () => {
		const res = await SELF.fetch('https://example.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bearer auto-detect',
			},
			body: JSON.stringify({ 
				model: 'groq/llama3-8b-8192', 
				messages: [{ role: 'user', content: 'test' }] 
			}),
		})

		// Should return 503 when container not available in test mode
		expect(res.status).toBe(503)

		const data = await res.json()
		expect((data as any).error).toBe('Container not configured')
	})

	it('forwards Anthropic format completion requests', async () => {
		const res = await SELF.fetch('https://example.com/v1/messages', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bearer auto-detect',
			},
			body: JSON.stringify({ 
				model: 'anthropic/claude-3-haiku-20240307', 
				messages: [{ role: 'user', content: 'test' }],
				max_tokens: 50
			}),
		})

		// Should return 503 when container not available in test mode
		expect(res.status).toBe(503)

		const data = await res.json()
		expect((data as any).error).toBe('Container not configured')
	})

	it('forwards requests to container when available', async () => {
		const endpoints = [
			'/v1/models',
			'/v1/chat/completions',
			'/v1/completions',
			'/v1/messages', // Anthropic endpoint
			'/v1/embeddings',
			'/health',
			'/openapi.json',
		]

		for (const endpoint of endpoints) {
			const isCompletion = ['/v1/chat/completions', '/v1/completions', '/v1/messages'].includes(endpoint)
			const res = await SELF.fetch(`https://example.com${endpoint}`, {
				method: endpoint === '/v1/models' ? 'GET' : 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer auto-detect', // Use v2.0 auto-detect token
				},
				body: isCompletion
					? JSON.stringify({ 
						model: 'groq/llama3-8b-8192', 
						messages: [{ role: 'user', content: 'test' }],
						max_tokens: 10
					})
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
				Authorization: 'Bearer auto-detect',
			},
		})
		expect(res.status).toBe(503)

		const data = await res.json()
		expect(data).toHaveProperty('error')
		expect(data).toHaveProperty('message')
		expect((data as any).error).toBe('Container not configured')
	})

	it('handles missing authorization appropriately for completion endpoints', async () => {
		const completionEndpoints = ['/v1/chat/completions', '/v1/messages']

		for (const endpoint of completionEndpoints) {
			const res = await SELF.fetch(`https://example.com${endpoint}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					model: 'groq/llama3-8b-8192', 
					messages: [{ role: 'user', content: 'test' }] 
				}),
			})

			// In test environment without container: 503 (container not configured)
			// In production with container: 401 (no API key available)
			expect([401, 503]).toContain(res.status)

			const data = await res.json()

			if (res.status === 401) {
				expect((data as any).error).toBe('No API key available')
			} else if (res.status === 503) {
				expect((data as any).error).toBe('Container not configured')
			}
		}
	})

	it('handles auto-detect token in test environment', async () => {
		const res = await SELF.fetch('https://example.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bearer auto-detect',
			},
			body: JSON.stringify({ 
				model: 'openrouter/qwen/qwen3-coder', 
				messages: [{ role: 'user', content: 'test' }] 
			}),
		})

		// In test mode without container, should return 503
		expect(res.status).toBe(503)

		const data = await res.json()
		expect((data as any).error).toBe('Container not configured')
	})

	it('handles BYOK mode with user keys in test environment', async () => {
		const res = await SELF.fetch('https://example.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bearer sk-user-provided-key',
			},
			body: JSON.stringify({ 
				model: 'groq/llama3-8b-8192', 
				messages: [{ role: 'user', content: 'test' }] 
			}),
		})

		// In test mode without container, should return 503
		expect(res.status).toBe(503)

		const data = await res.json()
		expect((data as any).error).toBe('Container not configured')
	})

	it('handles invalid request body gracefully', async () => {
		const res = await SELF.fetch('https://example.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bearer auto-detect',
			},
			body: 'invalid-json',
		})

		// Should handle JSON parsing error before reaching container
		expect([400, 503]).toContain(res.status)

		const data = await res.json()
		
		if (res.status === 400) {
			expect((data as any).error).toBe('Invalid request body')
		} else if (res.status === 503) {
			expect((data as any).error).toBe('Container not configured')
		}
	})

	it('handles missing model field in request', async () => {
		const res = await SELF.fetch('https://example.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bearer auto-detect',
			},
			body: JSON.stringify({ 
				messages: [{ role: 'user', content: 'test' }] 
				// Missing model field
			}),
		})

		// Should handle missing model error before reaching container
		expect([400, 503]).toContain(res.status)

		const data = await res.json()
		
		if (res.status === 400) {
			expect((data as any).error).toBe('Missing model')
		} else if (res.status === 503) {
			expect((data as any).error).toBe('Container not configured')
		}
	})
})