import { extractAuthToken } from '../utils/auth'
import {
	detectProviderFromModel,
	getAvailableProviders,
	getInternalApiKey,
} from '../utils/provider'
import { modifyRequestWithApiKey } from '../utils/request'

import type { Context } from 'hono'
import type { App } from '../context'
import type { ApiKeyResult, CompletionRequest, RouterError } from '../utils/types'

/**
 * Handle completion requests with simplified auth logic
 * @param c - Hono context
 * @returns Response from LiteLLM container
 */
export async function handleCompletion(c: Context<App>): Promise<Response> {
	try {
		// Extract auth token from request
		const providedToken = extractAuthToken(c.req.raw)

		// Parse request body to get model name
		let requestBody: CompletionRequest
		try {
			requestBody = await c.req.json()
		} catch (error) {
			return c.json<RouterError>(
				{
					error: 'Invalid request body',
					message: 'Request body must be valid JSON',
					details: error instanceof Error ? error.message : String(error),
				},
				400
			)
		}

		if (!requestBody.model) {
			return c.json<RouterError>(
				{
					error: 'Missing model',
					message: 'Request must include a model field',
				},
				400
			)
		}

		// Determine which API key to use
		const apiKeyResult = determineApiKey(providedToken, requestBody.model, c.env)

		if (!apiKeyResult.apiKey) {
			const availableProviders = getAvailableProviders(c.env)
			return c.json<RouterError>(
				{
					error: 'No API key available',
					message:
						apiKeyResult.source === 'none'
							? 'Provide Authorization header or use a supported model'
							: `No internal API key configured for detected provider: ${apiKeyResult.provider}`,
					details: `Available providers: ${availableProviders.join(', ')}`,
					code: 'NO_API_KEY',
				},
				401
			)
		}

		console.log(
			`Router: ${apiKeyResult.source} mode - Processing ${requestBody.model} with ${apiKeyResult.provider || 'user'} key`
		)

		// Modify request with chosen API key
		const modifiedRequest = modifyRequestWithApiKey(requestBody, c.req.raw, apiKeyResult.apiKey)

		// Get container instance and forward request
		const id = c.env.LITELLM_CONTAINER!.idFromName('litellm-instance')
		const container = c.env.LITELLM_CONTAINER!.get(id)

		const response = await container.fetch(modifiedRequest)
		return response
	} catch (error) {
		console.error('Completion handler error:', error)
		return c.json<RouterError>(
			{
				error: 'Completion request failed',
				message: 'Internal server error processing completion request',
				details: error instanceof Error ? error.message : String(error),
			},
			500
		)
	}
}

/**
 * Determine which API key to use based on provided token and model
 * @param providedToken - Token from Authorization header (if any)
 * @param modelName - Model name from request body
 * @param env - Environment bindings
 * @returns API key result with source and provider info
 */
function determineApiKey(providedToken: string | null, modelName: string, env: any): ApiKeyResult {
	// If user provided a real token (not "auto-detect"), use it directly (BYOK mode)
	if (providedToken && providedToken !== 'auto-detect') {
		return {
			apiKey: providedToken,
			source: 'user',
		}
	}

	// No user token - try to auto-detect provider and use internal key
	const detectedProvider = detectProviderFromModel(modelName)

	if (!detectedProvider) {
		return {
			apiKey: null,
			source: 'none',
		}
	}

	const internalKey = getInternalApiKey(detectedProvider, env)

	return {
		apiKey: internalKey,
		source: 'internal',
		provider: detectedProvider,
	}
}
