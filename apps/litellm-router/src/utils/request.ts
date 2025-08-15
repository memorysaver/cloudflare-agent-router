import type { CompletionRequest } from './types'

/**
 * Modify request body to inject API key
 * @param requestBody - The parsed request body
 * @param request - The original request
 * @param apiKey - The API key to inject
 * @returns A new Request with the API key injected
 */
export function modifyRequestWithApiKey(requestBody: CompletionRequest, request: Request, apiKey: string): Request {
	try {
		// Inject the API key into the body
		const modifiedBody = { ...requestBody, api_key: apiKey }
		
		// Create new request with modified body
		return new Request(request.url, {
			method: request.method,
			headers: request.headers,
			body: JSON.stringify(modifiedBody),
		})
	} catch (error) {
		throw new Error(`Failed to modify request: ${error instanceof Error ? error.message : String(error)}`)
	}
}

/**
 * Create a request with LiteLLM master key for non-completion endpoints
 * @param request - The original request
 * @param masterKey - The LiteLLM master key
 * @returns A new Request with master key authorization
 */
export function createMasterKeyRequest(request: Request, masterKey: string): Request {
	const headers = new Headers(request.headers)
	headers.set('Authorization', `Bearer ${masterKey}`)
	
	return new Request(request.url, {
		method: request.method,
		headers,
		body: request.body,
	})
}

/**
 * Check if request path is a completion endpoint
 * @param path - The request path
 * @returns True if it's a completion endpoint
 */
export function isCompletionRequest(path: string): boolean {
	return path.includes('/v1/chat/completions') || path.includes('/v1/completions') || path.includes('/v1/messages')
}