import { appRouter } from '@/lib/trpc'
import { createServerFileRoute } from '@tanstack/react-start/server'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'

export const ServerRoute = createServerFileRoute('/api/trpc/$').methods({
	GET: async ({ request }) => {
		return fetchRequestHandler({
			endpoint: '/api/trpc',
			req: request,
			router: appRouter,
			createContext: () => ({}),
		})
	},
	POST: async ({ request }) => {
		return fetchRequestHandler({
			endpoint: '/api/trpc',
			req: request,
			router: appRouter,
			createContext: () => ({}),
		})
	},
})
