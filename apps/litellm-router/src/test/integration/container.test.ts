import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

/**
 * Container Integration Tests
 * 
 * These tests are designed to run when the LiteLLM container is actually available.
 * They will be skipped in CI/CD but can be run locally with `wrangler dev` running.
 * 
 * To run these tests:
 * 1. Start the development server: `pnpm wrangler dev`
 * 2. Run tests against localhost: `curl http://localhost:8787/health/litellm`
 * 
 * Note: These tests require environment variables to be set:
 * - OPENAI_API_KEY or ANTHROPIC_API_KEY for actual LLM health checks
 */

describe('LiteLLM Container Integration Tests', () => {
	// Helper function to check if container is available
	const isContainerAvailable = async () => {
		try {
			const res = await SELF.fetch('https://example.com/health/liveliness')
			return res.status === 200
		} catch {
			return false
		}
	}

	it('comprehensive health check with container', async () => {
		const containerAvailable = await isContainerAvailable()
		
		if (!containerAvailable) {
			console.log('⏭️ Skipping container test - container not available')
			return
		}

		const res = await SELF.fetch('https://example.com/health/litellm')
		
		// With container available, should either succeed or return LiteLLM-specific errors
		expect([200, 400, 500]).toContain(res.status)
		
		const data = (await res.json()) as Record<string, unknown>
		expect(data).toHaveProperty('status')
		
		// If successful, should have healthy/unhealthy models
		if (res.status === 200) {
			expect(data).toHaveProperty('healthy_endpoints')
			expect(data).toHaveProperty('unhealthy_endpoints')
		}
	})

	it('readiness check with container', async () => {
		const containerAvailable = await isContainerAvailable()
		
		if (!containerAvailable) {
			console.log('⏭️ Skipping container test - container not available')
			return
		}

		const res = await SELF.fetch('https://example.com/health/readiness')
		
		// Should return readiness status
		expect([200, 503]).toContain(res.status)
		
		const data = (await res.json()) as Record<string, unknown>
		expect(data).toHaveProperty('status')
		
		if (res.status === 200) {
			expect(['ready', 'not_ready']).toContain(data.status)
		}
	})

	it('liveliness check with container', async () => {
		const containerAvailable = await isContainerAvailable()
		
		if (!containerAvailable) {
			console.log('⏭️ Skipping container test - container not available')
			return
		}

		const res = await SELF.fetch('https://example.com/health/liveliness')
		
		// Liveliness should always return 200 if container is running
		expect(res.status).toBe(200)
		
		const data = (await res.json()) as Record<string, unknown>
		// LiteLLM liveliness returns "I'm alive!" message
		expect(data).toHaveProperty('status')
	})

	it('models endpoint returns valid response with container', async () => {
		const containerAvailable = await isContainerAvailable()
		
		if (!containerAvailable) {
			console.log('⏭️ Skipping container test - container not available')
			return
		}

		const res = await SELF.fetch('https://example.com/v1/models')
		
		// Should return models list (may be empty if no API keys configured)
		expect([200, 400, 500]).toContain(res.status)
		
		if (res.status === 200) {
			const data = (await res.json()) as { object: string; data: unknown[] }
			expect(data.object).toBe('list')
			expect(Array.isArray(data.data)).toBe(true)
		}
	})

	it('chat completions endpoint handles requests with container', async () => {
		const containerAvailable = await isContainerAvailable()
		
		if (!containerAvailable) {
			console.log('⏭️ Skipping container test - container not available')
			return
		}

		const res = await SELF.fetch('https://example.com/v1/chat/completions', {
			method: 'POST',
			headers: { 
				'Content-Type': 'application/json',
				'Authorization': 'Bearer sk-1234'  // Use the default master key
			},
			body: JSON.stringify({
				model: 'gpt-3.5-turbo',
				messages: [{ role: 'user', content: 'Say "test"' }],
				max_tokens: 5
			}),
		})

		// May fail due to missing API keys, but should reach LiteLLM container
		expect([200, 400, 401, 500]).toContain(res.status)
		
		const data = (await res.json()) as Record<string, unknown>
		
		// If successful, should have OpenAI-compatible response structure
		if (res.status === 200) {
			expect(data).toHaveProperty('choices')
			expect(data).toHaveProperty('model')
			expect(data).toHaveProperty('usage')
		}
		
		// If failed, should have error structure
		if (res.status >= 400) {
			expect(data).toHaveProperty('error')
		}
	})
})

describe('Manual Testing Instructions', () => {
	it('provides manual testing commands', () => {
		const instructions = {
			'Start Development Server': 'pnpm wrangler dev',
			'Basic Health Check': 'curl http://localhost:8787/health',
			'LiteLLM Health Check': 'curl http://localhost:8787/health/litellm',
			'Readiness Check': 'curl http://localhost:8787/health/readiness',
			'Liveliness Check': 'curl http://localhost:8787/health/liveliness',
			'List Models': 'curl http://localhost:8787/v1/models',
			'Chat Completion Test': `curl -X POST http://localhost:8787/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-1234" \\
  -d '{"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "Hello!"}], "max_tokens": 5}'`
		}

		console.log('\n📋 Manual Testing Commands:')
		for (const [name, command] of Object.entries(instructions)) {
			console.log(`\n${name}:`)
			console.log(`  ${command}`)
		}

		// This test always passes - it's just for documentation
		expect(instructions).toBeDefined()
	})
})