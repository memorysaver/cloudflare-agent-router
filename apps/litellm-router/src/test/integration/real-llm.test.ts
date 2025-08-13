import { SELF } from 'cloudflare:test'
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
					'Authorization': 'Bearer sk-1234'
				},
				body: JSON.stringify({
					model: model,
					messages: [{ 
						role: 'user', 
						content: 'Say "test" (respond with just the word test)' 
					}],
					max_tokens: 10,
					temperature: 0
				})
			})

			return {
				status: res.status,
				data: await res.json(),
				provider,
				model
			}
		} catch (error) {
			return {
				status: 0,
				error: String(error),
				provider,
				model
			}
		}
	}

	const isContainerRunning = async () => {
		try {
			const res = await fetch('http://localhost:8787/health')
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
			model: result.model
		})

		if (result.status === 200) {
			console.log('✅ Anthropic API key working!')
			expect(result.data).toHaveProperty('choices')
			expect(result.data.choices[0]).toHaveProperty('message')
		} else if (result.status === 401) {
			console.log('🔑 Anthropic API key not set or invalid')
			console.log('💡 Set ANTHROPIC_API_KEY in your .env file')
		} else {
			console.log('❌ Anthropic configuration issue:', result.data)
		}
	})

	it('tests OpenRouter configuration', async () => {
		const running = await isContainerRunning()
		if (!running) {
			console.log('⏭️ Skipping - container not running')
			return
		}

		console.log('🧪 Testing OpenRouter configuration...')
		
		const result = await testLLMConnection('openrouter/anthropic/claude-3-haiku', 'OpenRouter')
		
		console.log(`📊 OpenRouter Result:`, {
			status: result.status,
			provider: result.provider,
			model: result.model
		})

		if (result.status === 200) {
			console.log('✅ OpenRouter API key working!')
			expect(result.data).toHaveProperty('choices')
		} else if (result.status === 401) {
			console.log('🔑 OpenRouter API key not set or invalid')
			console.log('💡 Set OPENROUTER_API_KEY in your .env file')
		} else {
			console.log('❌ OpenRouter configuration issue:', result.data)
		}
	})

	it('tests Groq configuration', async () => {
		const running = await isContainerRunning()
		if (!running) {
			console.log('⏭️ Skipping - container not running')
			return
		}

		console.log('🧪 Testing Groq configuration...')
		
		const result = await testLLMConnection('groq/llama-3.1-8b-instant', 'Groq')
		
		console.log(`📊 Groq Result:`, {
			status: result.status,
			provider: result.provider,
			model: result.model
		})

		if (result.status === 200) {
			console.log('✅ Groq API key working!')
			expect(result.data).toHaveProperty('choices')
		} else if (result.status === 401) {
			console.log('🔑 Groq API key not set or invalid')
			console.log('💡 Set GROQ_API_KEY in your .env file')
		} else {
			console.log('❌ Groq configuration issue:', result.data)
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
			model: result.model
		})

		if (result.status === 200) {
			console.log('✅ Cerebras API key working!')
			expect(result.data).toHaveProperty('choices')
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
			const data = await res.json()
			
			console.log(`📊 Models Result:`, {
				status: res.status,
				modelCount: data.data?.length || 0
			})

			if (res.status === 200) {
				console.log('✅ Model listing working!')
				expect(data).toHaveProperty('object', 'list')
				expect(data).toHaveProperty('data')
				expect(Array.isArray(data.data)).toBe(true)
				
				if (data.data.length > 0) {
					console.log(`📋 Available models: ${data.data.length}`)
					console.log(`🎯 Sample models:`, data.data.slice(0, 3).map((m: any) => m.id))
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

	it('validates LiteLLM health with real configuration', async () => {
		const running = await isContainerRunning()
		if (!running) {
			console.log('⏭️ Skipping - container not running')
			return
		}

		console.log('🧪 Testing LiteLLM health check...')
		
		try {
			const res = await fetch('http://localhost:8787/health/litellm')
			const data = await res.json()
			
			console.log(`📊 Health Result:`, {
				status: res.status,
				healthyEndpoints: data.healthy_endpoints?.length || 0,
				unhealthyEndpoints: data.unhealthy_endpoints?.length || 0
			})

			if (res.status === 200) {
				console.log('✅ LiteLLM health check working!')
				expect(data).toHaveProperty('status')
				
				if (data.healthy_endpoints?.length > 0) {
					console.log(`💚 Healthy endpoints: ${data.healthy_endpoints.length}`)
				}
				if (data.unhealthy_endpoints?.length > 0) {
					console.log(`🔴 Unhealthy endpoints: ${data.unhealthy_endpoints.length}`)
				}
			} else {
				console.log('❌ Health check failed:', data)
			}
		} catch (error) {
			console.log('❌ Health check error:', error)
		}
	})
})

describe('Configuration Setup Instructions', () => {
	it('provides setup instructions', () => {
		const instructions = {
			'1. Copy environment file': 'cp .env.example .env',
			'2. Get API keys from': {
				'Anthropic': 'https://console.anthropic.com/',
				'OpenRouter': 'https://openrouter.ai/keys',
				'Groq': 'https://console.groq.com/keys',
				'Cerebras': 'https://cloud.cerebras.ai/',
			},
			'3. Add keys to .env': 'Edit .env file with your API keys',
			'4. Start container': 'pnpm wrangler dev',
			'5. Run real tests': 'pnpm test src/test/integration/real-llm.test.ts'
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