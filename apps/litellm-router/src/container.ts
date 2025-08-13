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
	 * Lifecycle method called when container starts
	 */
	override onStart(): void {
		console.log('✅ LiteLLM Container started successfully')
		console.log(`🚀 LiteLLM proxy running on port ${this.defaultPort}`)
	}

	/**
	 * Lifecycle method called when container shuts down
	 */
	override onStop(): void {
		console.log('🛑 LiteLLM Container stopped')
	}

	/**
	 * Lifecycle method called when container encounters an error
	 */
	override onError(error: unknown): void {
		console.error('❌ LiteLLM Container error:', error)

		// Log specific error details for debugging
		if (error instanceof Error) {
			console.error('Error message:', error.message)
			console.error('Error stack:', error.stack)
		} else {
			console.error('Unknown error type:', String(error))
		}
	}

	/**
	 * Forward all requests to the LiteLLM container
	 */
	async fetch(request: Request): Promise<Response> {
		try {
			console.log(`📨 Container request: ${request.method} ${request.url}`)

			// Simple pass-through to container - Worker handles API key injection
			const response = await this.containerFetch(request)

			console.log(`✅ Container response: ${response.status}`)
			return response
		} catch (error) {
			console.error('❌ Container fetch error:', error)

			// Return a proper error response
			return new Response(
				JSON.stringify({
					error: 'Container request failed',
					details: error instanceof Error ? error.message : String(error),
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				}
			)
		}
	}
}
