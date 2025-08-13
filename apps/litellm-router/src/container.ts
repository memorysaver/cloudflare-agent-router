import { Container } from '@cloudflare/containers'

/**
 * LiteLLM Container - Manages the lifecycle of the LiteLLM proxy server
 *
 * This container runs the LiteLLM Python proxy that handles routing
 * requests to multiple LLM providers (OpenAI, Anthropic, etc.)
 */
export class LiteLLMContainer extends Container {
	// LiteLLM proxy runs on port 4000 by default
	defaultPort = 4000

	// Keep container alive for 10 minutes after last request
	sleepAfter = '10m'

	// Environment variables will be passed to the container at runtime
	// These will be set from the Worker's environment bindings

	override onStart() {
		console.log('LiteLLM container started successfully')
	}

	override onStop() {
		console.log('LiteLLM container stopped')
	}

	override onError(error: unknown) {
		console.error('LiteLLM container error:', error)
	}

	/**
	 * Forward request to the LiteLLM proxy running inside the container
	 */
	async containerFetch(path: string, options: RequestInit = {}): Promise<Response> {
		// Create a Request object with the proper configuration
		const request = new Request(`http://container:${this.defaultPort}${path}`, {
			...options,
			headers: {
				'Content-Type': 'application/json',
				...options.headers,
			},
		})

		// Use the Container's fetch method to communicate with the container
		return await this.fetch(request)
	}
}
