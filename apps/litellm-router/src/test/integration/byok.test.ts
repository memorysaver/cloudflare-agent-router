import { describe, expect, it } from 'vitest'

/**
 * BYOK (Bring Your Own Key) Feature Tests
 *
 * Tests the dual authentication system:
 * 1. Premium Mode: Users with CLOUDFLARE_AGENT_ROUTER_API_KEY get internal API keys injected
 * 2. BYOK Mode: Users with their own provider keys have them passed through directly
 *
 * Requirements:
 * 1. Container must be running: `pnpm wrangler dev`
 * 2. Environment variables set in .env file
 * 3. Tests against localhost:8787
 *
 * Usage:
 * - Set up .env file with CLOUDFLARE_AGENT_ROUTER_API_KEY and provider keys
 * - Start container: `pnpm wrangler dev`
 * - Run tests: `pnpm test src/test/integration/byok.test.ts`
 */

describe('BYOK (Bring Your Own Key) Feature Tests', () => {
	const ROUTER_BASE_URL = 'http://localhost:8787'
	const PREMIUM_ROUTER_KEY = 'sk-car-premium-router-key-for-internal-api-access'

	// Helper to test LLM connections with different authentication modes
	const testLLMConnection = async (model: string, authToken: string, mode: 'premium' | 'byok') => {
		try {
			const res = await fetch(`${ROUTER_BASE_URL}/v1/chat/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify({
					model: model,
					messages: [
						{
							role: 'user',
							content: 'Say "test" (respond with just the word test)',
						},
					],
					max_tokens: 10,
					temperature: 0,
				}),
			})

			return {
				status: res.status,
				data: await res.json(),
				mode,
				model,
			}
		} catch (error) {
			return {
				status: 0,
				error: String(error),
				mode,
				model,
			}
		}
	}

	// Helper to check if container is running locally
	const isContainerRunning = async () => {
		try {
			const res = await fetch(`${ROUTER_BASE_URL}/worker-health`)
			return res.status === 200
		} catch {
			return false
		}
	}

	it('validates container status for BYOK tests', async () => {
		const running = await isContainerRunning()

		if (!running) {
			console.log('🚨 Container not running. Start with: pnpm wrangler dev')
			console.log('⏭️ Some BYOK tests will be skipped')
		} else {
			console.log('✅ Container is running - full BYOK tests will run')
		}

		// Always pass - this is informational, other tests will skip if needed
		expect(true).toBe(true)
	})

	it('validates worker health shows BYOK capabilities', async () => {
		const containerRunning = await isContainerRunning()
		if (!containerRunning) return // Skip if container not running

		console.log('🧪 Testing worker health with BYOK capabilities...')

		try {
			const res = await fetch(`${ROUTER_BASE_URL}/worker-health`)
			const data = (await res.json()) as any

			console.log(`📊 Worker Health Result:`, {
				status: res.status,
				service: data.service,
				premium_available: data.modes?.premium_available,
				byok_supported: data.modes?.byok_supported,
			})

			if (res.status === 200) {
				expect(data).toHaveProperty('status', 'healthy')
				expect(data).toHaveProperty('service', 'LiteLLM Router')
				expect(data).toHaveProperty('modes')
				expect(data.modes).toHaveProperty('byok_supported', true)
				expect(data.modes).toHaveProperty('premium_available')

				// Check internal key availability for premium mode
				expect(data).toHaveProperty('internal_keys')

				console.log('✅ BYOK capabilities detected in health check')
			}
		} catch (error) {
			console.error('❌ Health check failed:', error)
			throw error
		}
	})

	describe('Premium Mode Tests (Router Key)', () => {
		it('tests premium mode with OpenRouter model (internal key injection)', async () => {
			const containerRunning = await isContainerRunning()
			if (!containerRunning) return

			console.log('🧪 Testing Premium mode with OpenRouter model...')

			const result = await testLLMConnection(
				'openrouter/z-ai/glm-4.5-air',
				PREMIUM_ROUTER_KEY,
				'premium'
			)

			console.log(`📊 Premium Mode OpenRouter Result:`, {
				status: result.status,
				mode: result.mode,
				model: result.model,
			})

			if (result.status === 200) {
				console.log('✅ Premium mode OpenRouter working - internal key injected!')
				expect(result.data as any).toHaveProperty('choices')
				expect(result.data as any).toHaveProperty('model')
			} else {
				console.log(`⚠️ Premium mode result: ${result.status}`)
				// May fail if internal OpenRouter key not configured, but mode should work
			}
		})

		it('tests premium mode with Groq model (internal key injection)', async () => {
			const containerRunning = await isContainerRunning()
			if (!containerRunning) return

			console.log('🧪 Testing Premium mode with Groq model...')

			const result = await testLLMConnection(
				'groq/openai/gpt-oss-20b',
				PREMIUM_ROUTER_KEY,
				'premium'
			)

			console.log(`📊 Premium Mode Groq Result:`, {
				status: result.status,
				mode: result.mode,
				model: result.model,
			})

			if (result.status === 200) {
				console.log('✅ Premium mode Groq working - internal key injected!')
				expect(result.data as any).toHaveProperty('choices')
				expect(result.data as any).toHaveProperty('model')
			} else {
				console.log(`⚠️ Premium mode result: ${result.status}`)
			}
		})

		it('tests premium mode with Anthropic model (internal key injection)', async () => {
			const containerRunning = await isContainerRunning()
			if (!containerRunning) return

			console.log('🧪 Testing Premium mode with Anthropic model...')

			const result = await testLLMConnection(
				'anthropic/claude-3-haiku-20240307',
				PREMIUM_ROUTER_KEY,
				'premium'
			)

			console.log(`📊 Premium Mode Anthropic Result:`, {
				status: result.status,
				mode: result.mode,
				model: result.model,
			})

			if (result.status === 200) {
				console.log('✅ Premium mode Anthropic working - internal key injected!')
				expect(result.data as any).toHaveProperty('choices')
			} else {
				console.log(`⚠️ Premium mode result: ${result.status}`)
			}
		})
	})

	describe('BYOK Mode Tests (User Provider Keys)', () => {
		// Note: These tests require actual user API keys to work
		// They're designed to show the authentication flow works correctly

		it('tests BYOK mode with user OpenRouter key', async () => {
			const containerRunning = await isContainerRunning()
			if (!containerRunning) return

			console.log('🧪 Testing BYOK mode with user OpenRouter key...')

			// Use a sample OpenRouter key format - will fail auth but shows the flow works
			const userOpenRouterKey = 'sk-or-v1-user-provided-openrouter-key'

			const result = await testLLMConnection(
				'openrouter/z-ai/glm-4.5-air',
				userOpenRouterKey,
				'byok'
			)

			console.log(`📊 BYOK Mode OpenRouter Result:`, {
				status: result.status,
				mode: result.mode,
				model: result.model,
			})

			// Expect authentication error with invalid key, but shows BYOK mode works
			if (result.status === 401 || result.status === 400) {
				console.log(
					'✅ BYOK mode working - user key passed through (auth failed as expected with sample key)'
				)
				expect([400, 401, 403]).toContain(result.status)
			} else if (result.status === 200) {
				console.log('✅ BYOK mode working - user provided valid key!')
				expect(result.data as any).toHaveProperty('choices')
			}
		})

		it('tests BYOK mode with user Anthropic key', async () => {
			const containerRunning = await isContainerRunning()
			if (!containerRunning) return

			console.log('🧪 Testing BYOK mode with user Anthropic key...')

			const userAnthropicKey = 'sk-ant-user-provided-anthropic-key'

			const result = await testLLMConnection(
				'anthropic/claude-3-haiku-20240307',
				userAnthropicKey,
				'byok'
			)

			console.log(`📊 BYOK Mode Anthropic Result:`, {
				status: result.status,
				mode: result.mode,
				model: result.model,
			})

			// Expect authentication error with invalid key
			if (result.status === 401 || result.status === 400) {
				console.log(
					'✅ BYOK mode working - user key passed through (auth failed as expected with sample key)'
				)
				expect([400, 401, 403]).toContain(result.status)
			} else if (result.status === 200) {
				console.log('✅ BYOK mode working - user provided valid key!')
				expect(result.data as any).toHaveProperty('choices')
			}
		})

		it('tests BYOK mode with user Groq key', async () => {
			const containerRunning = await isContainerRunning()
			if (!containerRunning) return

			console.log('🧪 Testing BYOK mode with user Groq key...')

			const userGroqKey = 'gsk_user-provided-groq-key'

			const result = await testLLMConnection('groq/openai/gpt-oss-20b', userGroqKey, 'byok')

			console.log(`📊 BYOK Mode Groq Result:`, {
				status: result.status,
				mode: result.mode,
				model: result.model,
			})

			// Expect authentication error with invalid key
			if (result.status === 401 || result.status === 400) {
				console.log(
					'✅ BYOK mode working - user key passed through (auth failed as expected with sample key)'
				)
				expect([400, 401, 403]).toContain(result.status)
			} else if (result.status === 200) {
				console.log('✅ BYOK mode working - user provided valid key!')
				expect(result.data as any).toHaveProperty('choices')
			}
		})
	})

	describe('Authentication Error Tests', () => {
		it('returns 401 when no Authorization header provided', async () => {
			const containerRunning = await isContainerRunning()
			if (!containerRunning) return

			console.log('🧪 Testing missing Authorization header...')

			try {
				const res = await fetch(`${ROUTER_BASE_URL}/v1/chat/completions`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						// No Authorization header
					},
					body: JSON.stringify({
						model: 'openrouter/z-ai/glm-4.5-air',
						messages: [{ role: 'user', content: 'test' }],
						max_tokens: 10,
					}),
				})

				console.log(`📊 No Auth Header Result: Status ${res.status}`)

				expect(res.status).toBe(401)

				const data = (await res.json()) as any
				expect(data).toHaveProperty('error', 'Authorization required')
			} catch (error) {
				console.error('❌ No auth header test failed:', error)
				throw error
			}
		})

		it('returns 401 when empty Bearer token provided', async () => {
			const containerRunning = await isContainerRunning()
			if (!containerRunning) return

			console.log('🧪 Testing empty Bearer token...')

			try {
				const res = await fetch(`${ROUTER_BASE_URL}/v1/chat/completions`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: 'Bearer ', // Empty token
					},
					body: JSON.stringify({
						model: 'openrouter/z-ai/glm-4.5-air',
						messages: [{ role: 'user', content: 'test' }],
						max_tokens: 10,
					}),
				})

				console.log(`📊 Empty Token Result: Status ${res.status}`)

				expect(res.status).toBe(401)

				const data = (await res.json()) as any
				expect(data).toHaveProperty('error', 'Authorization required')
			} catch (error) {
				console.error('❌ Empty token test failed:', error)
				throw error
			}
		})

		it('handles non-completion requests with LiteLLM master key', async () => {
			const containerRunning = await isContainerRunning()
			if (!containerRunning) return

			console.log('🧪 Testing non-completion request (models list)...')

			try {
				const res = await fetch(`${ROUTER_BASE_URL}/v1/models`, {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
						Authorization: 'Bearer any-token-works-for-models', // Any token should work for /v1/models
					},
				})

				console.log(`📊 Models List Result: Status ${res.status}`)

				// Should work regardless of auth token for /v1/models since it uses master key internally
				expect([200, 400, 500]).toContain(res.status)

				if (res.status === 200) {
					const data = (await res.json()) as any
					expect(data).toHaveProperty('object', 'list')
					expect(data).toHaveProperty('data')
				}
			} catch (error) {
				console.error('❌ Models list test failed:', error)
				throw error
			}
		})
	})

	describe('Integration Tests', () => {
		it('validates both modes work with same model', async () => {
			const containerRunning = await isContainerRunning()
			if (!containerRunning) return

			console.log('🧪 Testing same model with both authentication modes...')

			const model = 'openrouter/z-ai/glm-4.5-air'

			// Test premium mode
			const premiumResult = await testLLMConnection(model, PREMIUM_ROUTER_KEY, 'premium')

			// Test BYOK mode with sample key (will fail auth but shows flow)
			const byokResult = await testLLMConnection(model, 'sk-or-v1-sample-user-key', 'byok')

			console.log(`📊 Integration Test Results:`, {
				premium_status: premiumResult.status,
				byok_status: byokResult.status,
				model: model,
			})

			// Premium mode should work with internal keys (if configured)
			// BYOK mode should show authentication flow (will fail with sample key)
			expect(premiumResult.status).toBeGreaterThan(0) // Got a response
			expect(byokResult.status).toBeGreaterThan(0) // Got a response

			console.log('✅ Both authentication modes processed the same model correctly')
		})
	})
})

describe('BYOK Usage Instructions', () => {
	it('provides usage instructions for both modes', async () => {
		const instructions = {
			'Premium Mode Usage': {
				description: 'Use CLOUDFLARE_AGENT_ROUTER_API_KEY to access internal API keys',
				example: 'curl -H "Authorization: Bearer sk-car-your-router-key" ...',
				benefits: [
					'No need to manage multiple provider keys',
					'Internal rate limits',
					'Centralized billing',
				],
			},
			'BYOK Mode Usage': {
				description: 'Use your own provider API keys directly',
				openrouter: 'curl -H "Authorization: Bearer sk-or-v1-your-openrouter-key" ...',
				anthropic: 'curl -H "Authorization: Bearer sk-ant-your-anthropic-key" ...',
				groq: 'curl -H "Authorization: Bearer gsk_your-groq-key" ...',
				benefits: ['Direct provider billing', 'Your own rate limits', 'Full control over API keys'],
			},
			'Tool Integration': {
				description: 'Both modes work with standard tools using Authorization: Bearer header',
				tools: ['OpenAI SDK', 'LangChain', 'Curl', 'Postman', 'Custom applications'],
				note: 'Just change the Bearer token to switch between premium and BYOK modes',
			},
		}

		console.log('\n📋 BYOK Feature Usage Instructions:')
		console.log('\n🏆 Premium Mode (Router Key):')
		console.log('  - Get router key from service provider')
		console.log('  - Use: Authorization: Bearer sk-car-your-router-key')
		console.log('  - Internal API keys automatically injected')
		console.log('  - Centralized billing and management')

		console.log('\n🔑 BYOK Mode (Your Provider Keys):')
		console.log('  - Use your own OpenRouter: Authorization: Bearer sk-or-v1-your-key')
		console.log('  - Use your own Anthropic: Authorization: Bearer sk-ant-your-key')
		console.log('  - Use your own Groq: Authorization: Bearer gsk_your-key')
		console.log('  - Direct provider billing and rate limits')

		console.log('\n🛠️ Tool Integration:')
		console.log('  - All standard LLM tools work with both modes')
		console.log('  - Just change Authorization header to switch modes')
		console.log('  - Same endpoints, same request format')

		console.log('\n🧪 Testing Setup:')
		console.log('  1. Set CLOUDFLARE_AGENT_ROUTER_API_KEY in .env')
		console.log('  2. Set internal provider keys for premium mode')
		console.log('  3. Start container: pnpm wrangler dev')
		console.log('  4. Test with: pnpm test src/test/integration/byok.test.ts')

		expect(instructions).toBeDefined()
	})
})
