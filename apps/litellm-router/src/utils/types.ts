export interface ProviderPattern {
	provider: string
	pattern: RegExp
}

export interface CompletionRequest {
	model: string
	messages: Array<{
		role: string
		content: string
	}>
	max_tokens?: number
	temperature?: number
	stream?: boolean
	api_key?: string
	[key: string]: unknown
}

export interface ApiKeyResult {
	apiKey: string | null
	source: 'user' | 'internal' | 'none'
	provider?: string
}

export interface RouterError {
	error: string
	message: string
	details?: string
	code?: string
}

export type Provider = 'openrouter' | 'anthropic' | 'groq' | 'cerebras' | 'openai'
