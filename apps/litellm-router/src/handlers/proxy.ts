import type { Context } from 'hono'
import type { App } from '../context'
import type { RouterError } from '../utils/types'

import { createMasterKeyRequest } from '../utils/request'

/**
 * Handle non-completion requests (health, models, etc.)
 * These requests use the LiteLLM master key for authentication
 * @param c - Hono context
 * @returns Response from LiteLLM container
 */
export async function handleOtherRequests(c: Context<App>): Promise<Response> {
	try {
		// Check if master key is configured
		if (!c.env.LITELLM_MASTER_KEY) {
			return c.json<RouterError>({
				error: 'Master key not configured',
				message: 'LiteLLM master key is required for non-completion endpoints',
				code: 'MASTER_KEY_MISSING'
			}, 503)
		}
		
		console.log(`Router: Proxying ${c.req.method} ${c.req.path} with master key`)
		
		// Create request with LiteLLM master key
		const modifiedRequest = createMasterKeyRequest(c.req.raw, c.env.LITELLM_MASTER_KEY)
		
		// Get container instance and forward request
		const id = c.env.LITELLM_CONTAINER!.idFromName('litellm-instance')
		const container = c.env.LITELLM_CONTAINER!.get(id)
		
		const response = await container.fetch(modifiedRequest)
		return response
		
	} catch (error) {
		console.error('Proxy handler error:', error)
		return c.json<RouterError>({
			error: 'Proxy request failed',
			message: 'Internal server error forwarding request',
			details: error instanceof Error ? error.message : String(error)
		}, 500)
	}
}