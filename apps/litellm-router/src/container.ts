import { Container } from '@cloudflare/containers'

/**
 * LiteLLM Container - Simple proxy to LiteLLM running on port 4000
 */
export class LiteLLMContainer extends Container {
	// LiteLLM proxy runs on port 4000 by default
	defaultPort = 4000

	// Keep container alive for 10 minutes after last request
	sleepAfter = '10m'

	/**
	 * Forward all requests to the LiteLLM container
	 */
	async fetch(request: Request): Promise<Response> {
		// Simple pass-through to container - Worker handles API key injection
		return await this.containerFetch(request)
	}
}
