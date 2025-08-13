import { AppSidebar } from '@/components/app-sidebar'
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard-demo')({
	component: DashboardPage,
})

function DashboardPage() {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
					<div className="flex items-center gap-2 px-4">
						<SidebarTrigger className="-ml-1" />
						<Separator orientation="vertical" className="mr-2 h-4" />
						<Breadcrumb>
							<BreadcrumbList>
								<BreadcrumbItem className="hidden md:block">
									<BreadcrumbLink href="#">ACME Dashboard</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem>
									<BreadcrumbPage>Overview</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					</div>
				</header>

				<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
					{/* Welcome Section */}
					<div className="grid auto-rows-min gap-4 md:grid-cols-3">
						<div className="aspect-video rounded-xl bg-muted/50 flex items-center justify-center">
							<div className="text-center">
								<h2 className="text-2xl font-bold mb-2">Welcome Back!</h2>
								<p className="text-muted-foreground">
									Here's what's happening with your account today.
								</p>
							</div>
						</div>
						<div className="aspect-video rounded-xl bg-muted/50 flex items-center justify-center">
							<div className="text-center">
								<div className="text-3xl font-bold text-blue-600 mb-1">24</div>
								<p className="text-sm text-muted-foreground">Active Projects</p>
							</div>
						</div>
						<div className="aspect-video rounded-xl bg-muted/50 flex items-center justify-center">
							<div className="text-center">
								<div className="text-3xl font-bold text-green-600 mb-1">98.5%</div>
								<p className="text-sm text-muted-foreground">System Uptime</p>
							</div>
						</div>
					</div>

					{/* Content Cards */}
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						<Card>
							<CardHeader>
								<CardTitle>Quick Actions</CardTitle>
								<CardDescription>Common tasks you can perform</CardDescription>
							</CardHeader>
							<CardContent className="space-y-2">
								<button className="w-full text-left p-2 rounded hover:bg-muted transition-colors">
									📊 View Analytics
								</button>
								<button className="w-full text-left p-2 rounded hover:bg-muted transition-colors">
									🚀 Deploy Project
								</button>
								<button className="w-full text-left p-2 rounded hover:bg-muted transition-colors">
									👥 Manage Team
								</button>
								<button className="w-full text-left p-2 rounded hover:bg-muted transition-colors">
									⚙️ Settings
								</button>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Recent Activity</CardTitle>
								<CardDescription>Latest updates and changes</CardDescription>
							</CardHeader>
							<CardContent className="space-y-2">
								<div className="flex items-center space-x-2 text-sm">
									<div className="w-2 h-2 bg-green-500 rounded-full"></div>
									<span>Project Alpha deployed</span>
									<span className="text-muted-foreground ml-auto">2h ago</span>
								</div>
								<div className="flex items-center space-x-2 text-sm">
									<div className="w-2 h-2 bg-blue-500 rounded-full"></div>
									<span>New team member added</span>
									<span className="text-muted-foreground ml-auto">4h ago</span>
								</div>
								<div className="flex items-center space-x-2 text-sm">
									<div className="w-2 h-2 bg-orange-500 rounded-full"></div>
									<span>Server maintenance completed</span>
									<span className="text-muted-foreground ml-auto">1d ago</span>
								</div>
								<div className="flex items-center space-x-2 text-sm">
									<div className="w-2 h-2 bg-purple-500 rounded-full"></div>
									<span>Database backup created</span>
									<span className="text-muted-foreground ml-auto">2d ago</span>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>System Status</CardTitle>
								<CardDescription>Current health of your services</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="flex justify-between items-center">
									<span className="text-sm">API Gateway</span>
									<div className="flex items-center space-x-2">
										<div className="w-2 h-2 bg-green-500 rounded-full"></div>
										<span className="text-sm text-green-600">Operational</span>
									</div>
								</div>
								<div className="flex justify-between items-center">
									<span className="text-sm">Database</span>
									<div className="flex items-center space-x-2">
										<div className="w-2 h-2 bg-green-500 rounded-full"></div>
										<span className="text-sm text-green-600">Operational</span>
									</div>
								</div>
								<div className="flex justify-between items-center">
									<span className="text-sm">CDN</span>
									<div className="flex items-center space-x-2">
										<div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
										<span className="text-sm text-yellow-600">Degraded</span>
									</div>
								</div>
								<div className="flex justify-between items-center">
									<span className="text-sm">Monitoring</span>
									<div className="flex items-center space-x-2">
										<div className="w-2 h-2 bg-green-500 rounded-full"></div>
										<span className="text-sm text-green-600">Operational</span>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Large Content Area */}
					<div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min p-6">
						<h3 className="text-xl font-semibold mb-4">Main Content Area</h3>
						<p className="text-muted-foreground mb-6">
							This is where your main dashboard content would go. You can add charts, tables, forms,
							or any other components here.
						</p>

						{/* Placeholder content grid */}
						<div className="grid gap-4 md:grid-cols-2">
							<div className="p-4 border rounded-lg bg-background">
								<h4 className="font-medium mb-2">Analytics Overview</h4>
								<p className="text-sm text-muted-foreground">
									Charts and metrics would be displayed here. Integration with your analytics
									service or custom visualizations.
								</p>
							</div>

							<div className="p-4 border rounded-lg bg-background">
								<h4 className="font-medium mb-2">Performance Metrics</h4>
								<p className="text-sm text-muted-foreground">
									Real-time performance data, response times, error rates, and other key performance
									indicators.
								</p>
							</div>

							<div className="p-4 border rounded-lg bg-background">
								<h4 className="font-medium mb-2">User Management</h4>
								<p className="text-sm text-muted-foreground">
									User tables, permissions, role management, and user activity tracking interfaces.
								</p>
							</div>

							<div className="p-4 border rounded-lg bg-background">
								<h4 className="font-medium mb-2">Configuration</h4>
								<p className="text-sm text-muted-foreground">
									System settings, environment variables, feature flags, and other configuration
									options.
								</p>
							</div>
						</div>
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	)
}
