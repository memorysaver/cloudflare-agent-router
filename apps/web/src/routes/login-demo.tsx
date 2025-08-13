import { LoginForm } from '@/components/login-form'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/login-demo')({
	component: LoginPage,
})

function LoginPage() {
	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
			<div className="w-full max-w-4xl">
				<div className="text-center mb-8">
					<h1 className="text-3xl font-bold">ACME</h1>
					<p className="text-gray-600 mt-2">Welcome back! Please sign in to your account.</p>
				</div>
				<LoginForm />
			</div>
		</div>
	)
}
