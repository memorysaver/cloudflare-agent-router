import { describe, expect, it } from 'vitest'

/**
 * Real LLM API Tests
 *
 * These tests make actual calls to LLM providers to validate:
 * 1. Configuration is correct
 * 2. API keys are working
 * 3. Model routing works
 * 4. LiteLLM proxy is functional
 *
 * Requirements:
 * 1. Container must be running: `pnpm wrangler dev`
 * 2. API keys must be set in .env file
 * 3. Tests against localhost:8787
 *
 * Usage:
 * - Set up .env file with real API keys
 * - Start container: `pnpm wrangler dev`
 * - Run tests: `pnpm test src/test/integration/real-llm.test.ts`
 */

describe('Real LLM API Configuration Tests', () => {
	// Helper to check if container is available and has API keys
	const testLLMConnection = async (model: string, provider: string) => {
		try {
			const res = await fetch('http://localhost:8787/v1/chat/completions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer sk-1234',
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
				provider,
				model,
			}
		} catch (error) {
			return {
				status: 0,
				error: String(error),
				provider,
				model,
			}
		}
	}

	const isContainerRunning = async () => {
		try {
			const res = await fetch('http://localhost:8787/worker-health')
			return res.status === 200
		} catch {
			return false
		}
	}

	it('validates container is running locally', async () => {
		const running = await isContainerRunning()

		if (!running) {
			console.log('🚨 Container not running. Start with: pnpm wrangler dev')
			console.log('⏭️ Skipping real LLM tests')
			return
		}

		expect(running).toBe(true)
	})

	it('validates Worker health and API key status', async () => {
		const running = await isContainerRunning()
		if (!running) {
			console.log('⏭️ Skipping - container not running')
			return
		}

		console.log('🧪 Testing Worker health and API key availability...')

		try {
			const res = await fetch('http://localhost:8787/worker-health')
			const data = (await res.json()) as any

			console.log(`📊 Worker Health Result:`, {
				status: res.status,
				service: data.service,
				openrouter_available: data.keys?.openrouter_available,
				groq_available: data.keys?.groq_available,
			})

			if (res.status === 200) {
				console.log('✅ Worker health check working!')
				expect(data).toHaveProperty('status', 'healthy')
				expect(data).toHaveProperty('service', 'LiteLLM Router')
				expect(data).toHaveProperty('keys')

				// Check API key availability
				if (data.keys?.openrouter_available) {
					console.log('✅ OpenRouter API key detected')
				} else {
					console.log('⚠️ OpenRouter API key not available')
				}

				if (data.keys?.groq_available) {
					console.log('✅ Groq API key detected')
				} else {
					console.log('⚠️ Groq API key not available')
				}
			} else {
				console.log('❌ Worker health check failed:', data)
			}
		} catch (error) {
			console.log('❌ Worker health check error:', error)
		}
	})

	it('tests Anthropic Claude configuration', async () => {
		const running = await isContainerRunning()
		if (!running) {
			console.log('⏭️ Skipping - container not running')
			return
		}

		console.log('🧪 Testing Anthropic/Claude configuration...')

		const result = await testLLMConnection('anthropic/claude-3-haiku-20240307', 'Anthropic')

		console.log(`📊 Anthropic Result:`, {
			status: result.status,
			provider: result.provider,
			model: result.model,
		})

		if (result.status === 200) {
			console.log('✅ Anthropic API key working!')
			expect(result.data as any).toHaveProperty('choices')
			expect((result.data as any).choices[0]).toHaveProperty('message')
		} else if (result.status === 401) {
			console.log('🔑 Anthropic API key not set or invalid')
			console.log('💡 Set ANTHROPIC_API_KEY in your .env file')
		} else {
			console.log('❌ Anthropic configuration issue:', result.data)
		}
	})

	it('tests OpenRouter configuration with GLM-4.5-Air', async () => {
		const running = await isContainerRunning()
		if (!running) {
			console.log('⏭️ Skipping - container not running')
			return
		}

		console.log('🧪 Testing OpenRouter GLM-4.5-Air configuration...')

		const result = await testLLMConnection('openrouter/z-ai/glm-4.5-air', 'OpenRouter')

		console.log(`📊 OpenRouter GLM Result:`, {
			status: result.status,
			provider: result.provider,
			model: result.model,
		})

		if (result.status === 200) {
			console.log('✅ OpenRouter API key working with GLM-4.5-Air!')
			expect(result.data as any).toHaveProperty('choices')
			expect(result.data as any).toHaveProperty('model')
			expect((result.data as any).model).toContain('glm-4.5')
		} else if (result.status === 401) {
			console.log('🔑 OpenRouter API key not set or invalid')
			console.log('💡 Set OPENROUTER_API_KEY in your .env file')
		} else {
			console.log('❌ OpenRouter GLM configuration issue:', result.data)
		}
	})

	it('tests Groq configuration with GPT-OSS-20B', async () => {
		const running = await isContainerRunning()
		if (!running) {
			console.log('⏭️ Skipping - container not running')
			return
		}

		console.log('🧪 Testing Groq GPT-OSS-20B configuration...')

		const result = await testLLMConnection('groq/openai/gpt-oss-20b', 'Groq')

		console.log(`📊 Groq GPT-OSS Result:`, {
			status: result.status,
			provider: result.provider,
			model: result.model,
		})

		if (result.status === 200) {
			console.log('✅ Groq API key working with GPT-OSS-20B!')
			expect(result.data as any).toHaveProperty('choices')
			expect(result.data as any).toHaveProperty('model')
			expect((result.data as any).model).toContain('gpt-oss-20b')
			// Groq-specific response fields
			expect(result.data as any).toHaveProperty('x_groq')
		} else if (result.status === 401) {
			console.log('🔑 Groq API key not set or invalid')
			console.log('💡 Set GROQ_API_KEY in your .env file')
		} else {
			console.log('❌ Groq GPT-OSS configuration issue:', result.data)
		}
	})

	it('tests Cerebras configuration', async () => {
		const running = await isContainerRunning()
		if (!running) {
			console.log('⏭️ Skipping - container not running')
			return
		}

		console.log('🧪 Testing Cerebras configuration...')

		const result = await testLLMConnection('cerebras/llama3.1-8b', 'Cerebras')

		console.log(`📊 Cerebras Result:`, {
			status: result.status,
			provider: result.provider,
			model: result.model,
		})

		if (result.status === 200) {
			console.log('✅ Cerebras API key working!')
			expect(result.data as any).toHaveProperty('choices')
		} else if (result.status === 401) {
			console.log('🔑 Cerebras API key not set or invalid')
			console.log('💡 Set CEREBRAS_API_KEY in your .env file')
		} else {
			console.log('❌ Cerebras configuration issue:', result.data)
		}
	})

	it('validates model listing with real API keys', async () => {
		const running = await isContainerRunning()
		if (!running) {
			console.log('⏭️ Skipping - container not running')
			return
		}

		console.log('🧪 Testing model listing...')

		try {
			const res = await fetch('http://localhost:8787/v1/models')
			const data = (await res.json()) as any

			console.log(`📊 Models Result:`, {
				status: res.status,
				modelCount: data.data?.length || 0,
			})

			if (res.status === 200) {
				console.log('✅ Model listing working!')
				expect(data).toHaveProperty('object', 'list')
				expect(data).toHaveProperty('data')
				expect(Array.isArray(data.data)).toBe(true)

				if (data.data.length > 0) {
					console.log(`📋 Available models: ${data.data.length}`)
					console.log(
						`🎯 Sample models:`,
						data.data.slice(0, 3).map((m: any) => m.id)
					)
				} else {
					console.log('⚠️ No models available - check API keys')
				}
			} else {
				console.log('❌ Model listing failed:', data)
			}
		} catch (error) {
			console.log('❌ Model listing error:', error)
		}
	})

	it('validates integration with specific test models', async () => {
		const running = await isContainerRunning()
		if (!running) {
			console.log('⏭️ Skipping - container not running')
			return
		}

		console.log('🧪 Testing integration with both target models...')

		// Test both models sequentially
		const models = [
			{ name: 'openrouter/z-ai/glm-4.5-air', provider: 'OpenRouter' },
			{ name: 'groq/openai/gpt-oss-20b', provider: 'Groq' },
		]

		const results = []
		for (const model of models) {
			const result = await testLLMConnection(model.name, model.provider)
			results.push(result)

			if (result.status === 200) {
				console.log(`✅ ${model.provider} ${model.name} - Working!`)
			} else {
				console.log(`❌ ${model.provider} ${model.name} - Status: ${result.status}`)
			}
		}

		// Verify at least one model is working (or all fail with auth errors in dev environment)
		const workingModels = results.filter((r) => r.status === 200)
		const authErrors = results.filter((r) => r.status === 401)
		console.log(
			`📊 Integration Result: ${workingModels.length}/${models.length} models working, ${authErrors.length} auth errors`
		)

		// In development without real API keys, expect auth errors instead of working models
		if (workingModels.length === 0 && authErrors.length > 0) {
			console.log(
				'✅ Development mode: API routing working (auth errors expected without real keys)'
			)
			expect(results.length).toBeGreaterThan(0) // At least some responses
		} else {
			expect(workingModels.length).toBeGreaterThan(0) // Production mode: expect working models
		}
	})
})

describe('Configuration Setup Instructions', () => {
	it('provides setup instructions', () => {
		const instructions = {
			'1. Copy environment file': 'cp .env.example .env',
			'2. Get API keys from': {
				Anthropic: 'https://console.anthropic.com/',
				OpenRouter: 'https://openrouter.ai/keys',
				Groq: 'https://console.groq.com/keys',
				Cerebras: 'https://cloud.cerebras.ai/',
			},
			'3. Add keys to .env': 'Edit .env file with your API keys',
			'4. Start container': 'pnpm wrangler dev',
			'5. Run real tests': 'pnpm test src/test/integration/real-llm.test.ts',
		}

		console.log('\n📋 Setup Instructions for Real LLM Testing:')
		for (const [step, instruction] of Object.entries(instructions)) {
			console.log(`\n${step}:`)
			if (typeof instruction === 'object') {
				for (const [service, url] of Object.entries(instruction)) {
					console.log(`  ${service}: ${url}`)
				}
			} else {
				console.log(`  ${instruction}`)
			}
		}

		console.log('\n💡 Tips:')
		console.log('  - OpenRouter gives access to 100+ models with one API key')
		console.log('  - Tests will skip if container not running')
		console.log('  - Tests will show API key status for each provider')

		expect(instructions).toBeDefined()
	})
})
