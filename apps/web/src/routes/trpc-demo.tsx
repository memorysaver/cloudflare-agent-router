import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { trpcClient } from '@/lib/trpc-client'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/trpc-demo')({
	component: RouteComponent,
})

function RouteComponent() {
	const [name, setName] = useState('')
	const [newUserName, setNewUserName] = useState('')
	const [newUserEmail, setNewUserEmail] = useState('')
	const [greeting, setGreeting] = useState('')
	const [users, setUsers] = useState<any[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [isCreating, setIsCreating] = useState(false)
	const [createUserResult, setCreateUserResult] = useState<any>(null)

	// Fetch greeting when name changes
	useEffect(() => {
		if (name) {
			setIsLoading(true)
			trpcClient.greeting
				.query({ name })
				.then(setGreeting)
				.catch(console.error)
				.finally(() => setIsLoading(false))
		} else {
			setGreeting('')
		}
	}, [name])

	// Fetch users on mount
	useEffect(() => {
		setIsLoading(true)
		trpcClient.getUsers
			.query()
			.then(setUsers)
			.catch(console.error)
			.finally(() => setIsLoading(false))
	}, [])

	const handleCreateUser = async (e: React.FormEvent) => {
		e.preventDefault()
		if (newUserName && newUserEmail) {
			setIsCreating(true)
			try {
				const result = await trpcClient.createUser.mutate({
					name: newUserName,
					email: newUserEmail,
				})
				setCreateUserResult(result)
				setNewUserName('')
				setNewUserEmail('')
				// Refetch users
				const updatedUsers = await trpcClient.getUsers.query()
				setUsers(updatedUsers)
			} catch (error) {
				console.error('Error creating user:', error)
			} finally {
				setIsCreating(false)
			}
		}
	}

	return (
		<div className="container mx-auto p-6 space-y-6">
			<h1 className="text-3xl font-bold">Tech Stack Demo</h1>
			<p className="text-muted-foreground">
				Showcasing TanStack Start + Shadcn UI + tRPC integration
			</p>

			{/* Greeting Demo */}
			<Card>
				<CardHeader>
					<CardTitle>tRPC Query Demo</CardTitle>
					<CardDescription>Test type-safe API calls with tRPC</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="name">Enter your name:</Label>
						<Input
							id="name"
							type="text"
							placeholder="Your name..."
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
					</div>
					{greeting && (
						<div className="p-4 bg-muted rounded-lg">
							<p className="font-medium">{greeting}</p>
						</div>
					)}
					{isLoading && name && <p className="text-muted-foreground">Loading greeting...</p>}
				</CardContent>
			</Card>

			{/* Users List Demo */}
			<Card>
				<CardHeader>
					<CardTitle>Users List (tRPC Query)</CardTitle>
					<CardDescription>Fetched via tRPC from the server</CardDescription>
				</CardHeader>
				<CardContent>
					{isLoading && <p className="text-muted-foreground">Loading users...</p>}
					{users.length > 0 && (
						<div className="space-y-2">
							{users.map((user) => (
								<div key={user.id} className="flex justify-between items-center p-2 border rounded">
									<div>
										<p className="font-medium">{user.name}</p>
										<p className="text-sm text-muted-foreground">{user.email}</p>
									</div>
									<span className="text-xs text-muted-foreground">ID: {user.id}</span>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Create User Demo */}
			<Card>
				<CardHeader>
					<CardTitle>Create User (tRPC Mutation)</CardTitle>
					<CardDescription>Add a new user via tRPC mutation</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleCreateUser} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="newUserName">Name:</Label>
							<Input
								id="newUserName"
								type="text"
								placeholder="User name..."
								value={newUserName}
								onChange={(e) => setNewUserName(e.target.value)}
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="newUserEmail">Email:</Label>
							<Input
								id="newUserEmail"
								type="email"
								placeholder="user@example.com"
								value={newUserEmail}
								onChange={(e) => setNewUserEmail(e.target.value)}
								required
							/>
						</div>
						<Button type="submit" disabled={isCreating} className="w-full">
							{isCreating ? 'Creating...' : 'Create User'}
						</Button>
					</form>
					{createUserResult && (
						<div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
							<p className="text-green-800">
								✅ Created user: {createUserResult.name} ({createUserResult.email})
							</p>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Shadcn UI Components Demo */}
			<Card>
				<CardHeader>
					<CardTitle>Shadcn UI Components</CardTitle>
					<CardDescription>Various UI components from the Shadcn library</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex gap-2 flex-wrap">
						<Button>Default Button</Button>
						<Button variant="secondary">Secondary</Button>
						<Button variant="destructive">Destructive</Button>
						<Button variant="outline">Outline</Button>
						<Button variant="ghost">Ghost</Button>
						<Button variant="link">Link</Button>
					</div>
					<div className="space-y-2">
						<Label>Sample Input</Label>
						<Input placeholder="This is a Shadcn Input component" />
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
