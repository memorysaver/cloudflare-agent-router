import { Button } from '@/components/ui/button'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/landing-demo')({
	component: LandingPage,
})

function LandingPage() {
	return (
		<div className="min-h-screen flex flex-col">
			{/* Header */}
			<header className="border-b">
				<div className="container mx-auto px-4 py-4 flex justify-between items-center">
					<div className="text-2xl font-bold">ACME</div>
					<nav className="hidden md:flex space-x-6">
						<a href="#" className="text-gray-600 hover:text-gray-900">
							Features
						</a>
						<a href="#" className="text-gray-600 hover:text-gray-900">
							Pricing
						</a>
						<a href="#" className="text-gray-600 hover:text-gray-900">
							About
						</a>
						<a href="#" className="text-gray-600 hover:text-gray-900">
							Contact
						</a>
					</nav>
					<div className="space-x-2">
						<Button variant="ghost">Sign In</Button>
						<Button>Get Started</Button>
					</div>
				</div>
			</header>

			{/* Hero Section */}
			<main className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
				<div className="container mx-auto px-4 py-20 text-center">
					<h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">Welcome to ACME</h1>
					<p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
						Build amazing products with our cutting-edge platform. Fast, reliable, and designed for
						scale.
					</p>
					<div className="space-x-4">
						<Button size="lg" className="text-lg px-8 py-3">
							Start Free Trial
						</Button>
						<Button variant="outline" size="lg" className="text-lg px-8 py-3">
							Learn More
						</Button>
					</div>

					{/* Simple feature highlights */}
					<div className="mt-16 grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
						<div className="text-center">
							<div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
								<svg
									className="w-6 h-6 text-blue-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M13 10V3L4 14h7v7l9-11h-7z"
									/>
								</svg>
							</div>
							<h3 className="text-lg font-semibold mb-2">Lightning Fast</h3>
							<p className="text-gray-600">Built for performance and speed</p>
						</div>

						<div className="text-center">
							<div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
								<svg
									className="w-6 h-6 text-green-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
							</div>
							<h3 className="text-lg font-semibold mb-2">Reliable</h3>
							<p className="text-gray-600">99.9% uptime guarantee</p>
						</div>

						<div className="text-center">
							<div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
								<svg
									className="w-6 h-6 text-purple-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
									/>
								</svg>
							</div>
							<h3 className="text-lg font-semibold mb-2">Scalable</h3>
							<p className="text-gray-600">Grows with your business</p>
						</div>
					</div>
				</div>
			</main>

			{/* Footer */}
			<footer className="border-t bg-gray-50">
				<div className="container mx-auto px-4 py-8">
					<div className="grid md:grid-cols-4 gap-8">
						<div>
							<div className="text-lg font-bold mb-4">ACME</div>
							<p className="text-gray-600 text-sm">Building the future, one product at a time.</p>
						</div>

						<div>
							<h4 className="font-semibold mb-3">Product</h4>
							<ul className="space-y-2 text-sm text-gray-600">
								<li>
									<a href="#" className="hover:text-gray-900">
										Features
									</a>
								</li>
								<li>
									<a href="#" className="hover:text-gray-900">
										Pricing
									</a>
								</li>
								<li>
									<a href="#" className="hover:text-gray-900">
										Documentation
									</a>
								</li>
							</ul>
						</div>

						<div>
							<h4 className="font-semibold mb-3">Company</h4>
							<ul className="space-y-2 text-sm text-gray-600">
								<li>
									<a href="#" className="hover:text-gray-900">
										About
									</a>
								</li>
								<li>
									<a href="#" className="hover:text-gray-900">
										Blog
									</a>
								</li>
								<li>
									<a href="#" className="hover:text-gray-900">
										Careers
									</a>
								</li>
							</ul>
						</div>

						<div>
							<h4 className="font-semibold mb-3">Support</h4>
							<ul className="space-y-2 text-sm text-gray-600">
								<li>
									<a href="#" className="hover:text-gray-900">
										Help Center
									</a>
								</li>
								<li>
									<a href="#" className="hover:text-gray-900">
										Contact
									</a>
								</li>
								<li>
									<a href="#" className="hover:text-gray-900">
										Status
									</a>
								</li>
							</ul>
						</div>
					</div>

					<div className="border-t mt-8 pt-8 text-center text-sm text-gray-600">
						© 2024 ACME Corp. All rights reserved.
					</div>
				</div>
			</footer>
		</div>
	)
}
