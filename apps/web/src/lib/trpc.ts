import { initTRPC } from '@trpc/server'
import { z } from 'zod'

// Initialize tRPC
const t = initTRPC.create()

// Export reusable router and procedure helpers
export const router = t.router
export const publicProcedure = t.procedure

// Example procedures
export const appRouter = router({
	// Simple greeting procedure
	greeting: publicProcedure.input(z.object({ name: z.string() })).query(({ input }) => {
		console.log('[tRPC] greeting called with:', input)
		const response = `Hello ${input.name}!`
		console.log('[tRPC] greeting response:', response)
		return response
	}),

	// Example data fetching procedure
	getUsers: publicProcedure.query(() => {
		console.log('[tRPC] getUsers called')
		// This could fetch from a database, API, etc.
		const users = [
			{ id: 1, name: 'Alice', email: 'alice@example.com' },
			{ id: 2, name: 'Bob', email: 'bob@example.com' },
			{ id: 3, name: 'Charlie', email: 'charlie@example.com' },
		]
		console.log('[tRPC] getUsers response:', users)
		return users
	}),

	// Example mutation procedure
	createUser: publicProcedure
		.input(
			z.object({
				name: z.string().min(1),
				email: z.string().email(),
			})
		)
		.mutation(({ input }) => {
			console.log('[tRPC] createUser called with:', input)
			// This could save to a database
			const newUser = {
				id: Math.floor(Math.random() * 1000),
				name: input.name,
				email: input.email,
			}
			console.log('[tRPC] createUser response:', newUser)
			return newUser
		}),
})

// Export the router type for client-side usage
export type AppRouter = typeof appRouter
