import { createTRPCClient, httpBatchLink } from '@trpc/client'

import type { AppRouter } from './trpc'

// Get the base URL for tRPC requests
function getBaseUrl() {
	if (typeof window !== 'undefined') {
		// Browser should use relative URL
		return ''
	}
	// SSR should use absolute URL
	return 'http://localhost:3000'
}

// Create vanilla tRPC client
export const trpcClient = createTRPCClient<AppRouter>({
	links: [
		httpBatchLink({
			url: `${getBaseUrl()}/api/trpc`,
		}),
	],
})
