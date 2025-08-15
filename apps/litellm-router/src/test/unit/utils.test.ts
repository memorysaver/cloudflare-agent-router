import { describe, expect, it } from 'vitest'
import { extractAuthToken } from '../../utils/auth'
import { detectProviderFromModel, getInternalApiKey, getAvailableProviders } from '../../utils/provider'
import { modifyRequestWithApiKey, isCompletionRequest } from '../../utils/request'
import type { CompletionRequest } from '../../utils/types'

describe('Auth Utilities', () => {
	describe('extractAuthToken', () => {
		it('extracts Bearer token correctly', () => {
			const request = new Request('https://example.com', {
				headers: { Authorization: 'Bearer sk-test-token-123' }
			})
			
			expect(extractAuthToken(request)).toBe('sk-test-token-123')
		})

		it('handles Bearer token with extra spaces', () => {
			const request = new Request('https://example.com', {
				headers: { Authorization: '  Bearer   sk-test-token-123  ' }
			})
			
			expect(extractAuthToken(request)).toBe('sk-test-token-123')
		})

		it('handles non-Bearer authorization header', () => {
			const request = new Request('https://example.com', {
				headers: { Authorization: 'sk-test-token-without-bearer' }
			})
			
			expect(extractAuthToken(request)).toBe('sk-test-token-without-bearer')
		})

		it('returns null for missing Authorization header', () => {
			const request = new Request('https://example.com')
			
			expect(extractAuthToken(request)).toBeNull()
		})

		it('returns null for empty Bearer token', () => {
			const request = new Request('https://example.com', {
				headers: { Authorization: 'Bearer ' }
			})
			
			expect(extractAuthToken(request)).toBeNull()
		})

		it('returns null for empty Authorization header', () => {
			const request = new Request('https://example.com', {
				headers: { Authorization: '' }
			})
			
			expect(extractAuthToken(request)).toBeNull()
		})

		it('handles auto-detect token correctly', () => {
			const request = new Request('https://example.com', {
				headers: { Authorization: 'Bearer auto-detect' }
			})
			
			expect(extractAuthToken(request)).toBe('auto-detect')
		})
	})
})

describe('Provider Detection Utilities', () => {
	describe('detectProviderFromModel', () => {
		it('detects OpenRouter models', () => {
			expect(detectProviderFromModel('openrouter/qwen/qwen3-coder')).toBe('openrouter')
			expect(detectProviderFromModel('openrouter/anthropic/claude-3-haiku')).toBe('openrouter')
			expect(detectProviderFromModel('openrouter/meta-llama/llama-3-8b-instruct')).toBe('openrouter')
		})

		it('detects Anthropic models', () => {
			expect(detectProviderFromModel('anthropic/claude-3-haiku-20240307')).toBe('anthropic')
			expect(detectProviderFromModel('claude-3-sonnet-20240229')).toBe('anthropic')
			expect(detectProviderFromModel('claude-3-opus-20240229')).toBe('anthropic')
		})

		it('detects Groq models', () => {
			expect(detectProviderFromModel('groq/llama3-8b-8192')).toBe('groq')
			expect(detectProviderFromModel('llama3-70b-8192')).toBe('groq')
			expect(detectProviderFromModel('mixtral-8x7b-32768')).toBe('groq')
		})

		it('detects Cerebras models', () => {
			expect(detectProviderFromModel('cerebras/llama3.1-8b')).toBe('cerebras')
			expect(detectProviderFromModel('cerebras/llama3.1-70b')).toBe('cerebras')
		})

		it('detects OpenAI models', () => {
			expect(detectProviderFromModel('openai/gpt-4')).toBe('openai')
			expect(detectProviderFromModel('gpt-4o-mini')).toBe('openai')
			expect(detectProviderFromModel('text-davinci-003')).toBe('openai')
			expect(detectProviderFromModel('davinci-002')).toBe('openai')
		})

		it('returns null for unknown models', () => {
			expect(detectProviderFromModel('unknown-provider/model')).toBeNull()
			expect(detectProviderFromModel('random-model-name')).toBeNull()
			expect(detectProviderFromModel('')).toBeNull()
		})

		it('follows first-match-wins priority', () => {
			// If a model matches multiple patterns, first one wins
			expect(detectProviderFromModel('openrouter/openai/gpt-4')).toBe('openrouter')
		})
	})

	describe('getInternalApiKey', () => {
		it('retrieves API key for configured provider', () => {
			const mockEnv = {
				OPENROUTER_API_KEY: 'sk-or-test-key',
				ANTHROPIC_API_KEY: 'sk-ant-test-key'
			}

			expect(getInternalApiKey('openrouter', mockEnv)).toBe('sk-or-test-key')
			expect(getInternalApiKey('anthropic', mockEnv)).toBe('sk-ant-test-key')
		})

		it('returns null for unconfigured provider', () => {
			const mockEnv = {
				OPENROUTER_API_KEY: 'sk-or-test-key'
			}

			expect(getInternalApiKey('anthropic', mockEnv)).toBeNull()
			expect(getInternalApiKey('groq', mockEnv)).toBeNull()
		})

		it('handles all supported providers', () => {
			const mockEnv = {
				OPENROUTER_API_KEY: 'sk-or-key',
				ANTHROPIC_API_KEY: 'sk-ant-key',
				GROQ_API_KEY: 'gsk-groq-key',
				CEREBRAS_API_KEY: 'csk-cerebras-key',
				OPENAI_API_KEY: 'sk-openai-key'
			}

			expect(getInternalApiKey('openrouter', mockEnv)).toBe('sk-or-key')
			expect(getInternalApiKey('anthropic', mockEnv)).toBe('sk-ant-key')
			expect(getInternalApiKey('groq', mockEnv)).toBe('gsk-groq-key')
			expect(getInternalApiKey('cerebras', mockEnv)).toBe('csk-cerebras-key')
			expect(getInternalApiKey('openai', mockEnv)).toBe('sk-openai-key')
		})
	})

	describe('getAvailableProviders', () => {
		it('returns providers with configured API keys', () => {
			const mockEnv = {
				OPENROUTER_API_KEY: 'sk-or-key',
				ANTHROPIC_API_KEY: 'sk-ant-key',
				// GROQ_API_KEY not set
				CEREBRAS_API_KEY: 'csk-cerebras-key'
				// OPENAI_API_KEY not set
			}

			const available = getAvailableProviders(mockEnv)
			expect(available).toContain('openrouter')
			expect(available).toContain('anthropic')
			expect(available).toContain('cerebras')
			expect(available).not.toContain('groq')
			expect(available).not.toContain('openai')
		})

		it('returns empty array when no keys configured', () => {
			const mockEnv = {}
			
			expect(getAvailableProviders(mockEnv)).toEqual([])
		})

		it('ignores empty/undefined API keys', () => {
			const mockEnv = {
				OPENROUTER_API_KEY: 'sk-or-key',
				ANTHROPIC_API_KEY: '', // Empty string
				GROQ_API_KEY: undefined // Undefined
			}

			const available = getAvailableProviders(mockEnv)
			expect(available).toEqual(['openrouter'])
		})
	})
})

describe('Request Utilities', () => {
	describe('isCompletionRequest', () => {
		it('detects OpenAI chat completions endpoint', () => {
			expect(isCompletionRequest('/v1/chat/completions')).toBe(true)
			expect(isCompletionRequest('https://api.openai.com/v1/chat/completions')).toBe(true)
		})

		it('detects OpenAI completions endpoint', () => {
			expect(isCompletionRequest('/v1/completions')).toBe(true)
			expect(isCompletionRequest('https://api.openai.com/v1/completions')).toBe(true)
		})

		it('detects Anthropic messages endpoint', () => {
			expect(isCompletionRequest('/v1/messages')).toBe(true)
			expect(isCompletionRequest('https://api.anthropic.com/v1/messages')).toBe(true)
		})

		it('rejects non-completion endpoints', () => {
			expect(isCompletionRequest('/v1/models')).toBe(false)
			expect(isCompletionRequest('/health')).toBe(false)
			expect(isCompletionRequest('/worker-health')).toBe(false)
			expect(isCompletionRequest('/v1/embeddings')).toBe(false)
			expect(isCompletionRequest('/')).toBe(false)
		})

		it('handles partial path matches correctly', () => {
			// Should match when the endpoint is contained in the path
			expect(isCompletionRequest('/api/v1/chat/completions')).toBe(true)
			expect(isCompletionRequest('/proxy/v1/messages')).toBe(true)
			
			// Should not match partial substrings
			expect(isCompletionRequest('/v1/chat/completions/extra')).toBe(true) // Still contains the endpoint
			expect(isCompletionRequest('/v1/message')).toBe(false) // Not exact match
		})
	})

	describe('modifyRequestWithApiKey', () => {
		it('injects API key into request body', () => {
			const originalBody: CompletionRequest = {
				model: 'gpt-4',
				messages: [{ role: 'user', content: 'Hello' }],
				max_tokens: 50
			}

			const originalRequest = new Request('https://example.com/v1/chat/completions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(originalBody)
			})

			const modifiedRequest = modifyRequestWithApiKey(originalBody, originalRequest, 'sk-test-key')

			expect(modifiedRequest.url).toBe(originalRequest.url)
			expect(modifiedRequest.method).toBe('POST')
			expect(modifiedRequest.headers.get('Content-Type')).toBe('application/json')

			// Check that API key was injected
			return modifiedRequest.json().then((body: any) => {
				expect(body.model).toBe('gpt-4')
				expect(body.messages).toEqual([{ role: 'user', content: 'Hello' }])
				expect(body.max_tokens).toBe(50)
				expect(body.api_key).toBe('sk-test-key')
			})
		})

		it('preserves original request properties', () => {
			const originalBody: CompletionRequest = {
				model: 'claude-3-haiku',
				messages: [{ role: 'user', content: 'Test' }]
			}

			const originalRequest = new Request('https://example.com/v1/messages', {
				method: 'POST',
				headers: { 
					'Content-Type': 'application/json',
					'User-Agent': 'Test-Client',
					'Custom-Header': 'custom-value'
				},
				body: JSON.stringify(originalBody)
			})

			const modifiedRequest = modifyRequestWithApiKey(originalBody, originalRequest, 'sk-ant-key')

			expect(modifiedRequest.url).toBe('https://example.com/v1/messages')
			expect(modifiedRequest.method).toBe('POST')
			expect(modifiedRequest.headers.get('Content-Type')).toBe('application/json')
			expect(modifiedRequest.headers.get('User-Agent')).toBe('Test-Client')
			expect(modifiedRequest.headers.get('Custom-Header')).toBe('custom-value')
		})

		it('handles complex request bodies', () => {
			const originalBody: CompletionRequest = {
				model: 'openrouter/qwen/qwen3-coder',
				messages: [
					{ role: 'system', content: 'You are a helpful assistant.' },
					{ role: 'user', content: 'Write a function to calculate fibonacci numbers.' }
				],
				max_tokens: 500,
				temperature: 0.7,
				top_p: 0.9,
				stream: false
			}

			const originalRequest = new Request('https://example.com/v1/chat/completions', {
				method: 'POST',
				body: JSON.stringify(originalBody)
			})

			const modifiedRequest = modifyRequestWithApiKey(originalBody, originalRequest, 'sk-or-key')

			return modifiedRequest.json().then((body: any) => {
				expect(body.model).toBe('openrouter/qwen/qwen3-coder')
				expect(body.messages).toHaveLength(2)
				expect(body.max_tokens).toBe(500)
				expect(body.temperature).toBe(0.7)
				expect(body.top_p).toBe(0.9)
				expect(body.stream).toBe(false)
				expect(body.api_key).toBe('sk-or-key')
			})
		})

		it('throws error on invalid request modification', () => {
			// Create a request body that will cause JSON.stringify to fail
			const circularBody = {} as any
			circularBody.self = circularBody

			const originalRequest = new Request('https://example.com/v1/chat/completions', {
				method: 'POST'
			})

			expect(() => {
				modifyRequestWithApiKey(circularBody, originalRequest, 'sk-key')
			}).toThrow('Failed to modify request')
		})
	})
})

describe('Type Validation', () => {
	describe('CompletionRequest interface', () => {
		it('accepts valid completion request', () => {
			const validRequest: CompletionRequest = {
				model: 'gpt-4',
				messages: [{ role: 'user', content: 'Hello' }]
			}

			expect(validRequest.model).toBe('gpt-4')
			expect(validRequest.messages).toHaveLength(1)
		})

		it('accepts optional parameters', () => {
			const requestWithOptionals: CompletionRequest = {
				model: 'claude-3-haiku',
				messages: [{ role: 'user', content: 'Test' }],
				max_tokens: 100,
				temperature: 0.5,
				top_p: 0.9,
				stream: true
			}

			expect(requestWithOptionals.max_tokens).toBe(100)
			expect(requestWithOptionals.temperature).toBe(0.5)
			expect(requestWithOptionals.stream).toBe(true)
		})
	})
})

describe('Edge Cases and Error Handling', () => {
	describe('Provider detection edge cases', () => {
		it('handles case sensitivity', () => {
			expect(detectProviderFromModel('OPENROUTER/model')).toBe('openrouter')
			expect(detectProviderFromModel('OpenRouter/model')).toBe('openrouter')
		})

		it('handles special characters in model names', () => {
			expect(detectProviderFromModel('openrouter/meta-llama/llama-3.1-8b-instruct')).toBe('openrouter')
			expect(detectProviderFromModel('anthropic/claude-3-haiku-20240307')).toBe('anthropic')
		})

		it('handles very long model names', () => {
			const longModelName = 'openrouter/' + 'a'.repeat(1000)
			expect(detectProviderFromModel(longModelName)).toBe('openrouter')
		})
	})

	describe('Auth token edge cases', () => {
		it('handles malformed Authorization headers', () => {
			const request1 = new Request('https://example.com', {
				headers: { Authorization: 'NotBearer token' }
			})
			expect(extractAuthToken(request1)).toBe('NotBearer token')

			const request2 = new Request('https://example.com', {
				headers: { Authorization: 'Bearer' }
			})
			expect(extractAuthToken(request2)).toBeNull()
		})

		it('handles special tokens', () => {
			const request = new Request('https://example.com', {
				headers: { Authorization: 'Bearer null' }
			})
			expect(extractAuthToken(request)).toBe('null')
		})
	})
})