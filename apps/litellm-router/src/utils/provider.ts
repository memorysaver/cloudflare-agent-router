import type { Env } from '../context'
import type { Provider, ProviderPattern } from './types'

/**
 * Provider detection patterns with priority order
 * First match wins, so order matters
 */
const PROVIDER_PATTERNS: ProviderPattern[] = [
	{ provider: 'openrouter', pattern: /^openrouter\// },
	{ provider: 'anthropic', pattern: /^(anthropic\/|claude-)/ },
	{ provider: 'groq', pattern: /^(groq\/|llama|mixtral)/ },
	{ provider: 'cerebras', pattern: /^cerebras\// },
	{ provider: 'openai', pattern: /^(openai\/|gpt-|text-|davinci)/ },
]

/**
 * Detect provider from model name using regex patterns
 * @param modelName - The model name from the request
 * @returns The detected provider name or null if not found
 */
export function detectProviderFromModel(modelName: string): Provider | null {
	if (!modelName || typeof modelName !== 'string') {
		return null
	}

	const normalizedModel = modelName.toLowerCase().trim()

	for (const { provider, pattern } of PROVIDER_PATTERNS) {
		if (pattern.test(normalizedModel)) {
			return provider as Provider
		}
	}

	return null
}

/**
 * Get internal API key for a specific provider
 * @param provider - The provider name
 * @param env - The environment bindings
 * @returns The API key or null if not available
 */
export function getInternalApiKey(provider: Provider, env: Env): string | null {
	switch (provider) {
		case 'openrouter':
			return env.OPENROUTER_API_KEY || null
		case 'anthropic':
			return env.ANTHROPIC_API_KEY || null
		case 'groq':
			return env.GROQ_API_KEY || null
		case 'cerebras':
			return env.CEREBRAS_API_KEY || null
		case 'openai':
			return env.OPENAI_API_KEY || null
		default:
			return null
	}
}

/**
 * Get all available providers (for error messages)
 * @param env - The environment bindings
 * @returns Array of available provider names
 */
export function getAvailableProviders(env: Env): Provider[] {
	const providers: Provider[] = []

	if (env.OPENROUTER_API_KEY) providers.push('openrouter')
	if (env.ANTHROPIC_API_KEY) providers.push('anthropic')
	if (env.GROQ_API_KEY) providers.push('groq')
	if (env.CEREBRAS_API_KEY) providers.push('cerebras')
	if (env.OPENAI_API_KEY) providers.push('openai')

	return providers
}
