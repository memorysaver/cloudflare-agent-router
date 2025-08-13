import { Button } from '@/components/ui/button'
import { Bell, Bookmark, Home, Plus, Settings } from 'lucide-react'

interface IconButtonProps {
	icon: React.ReactNode
	active?: boolean
	onClick?: () => void
}

function IconButton({ icon, active = false, onClick }: IconButtonProps) {
	return (
		<Button
			variant="ghost"
			size="icon"
			className={`
        w-10 h-10 lg:w-12 lg:h-12 rounded-full transition-all duration-200
        ${
					active
						? 'bg-black text-white hover:bg-gray-800'
						: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
				}
      `}
			onClick={onClick}
		>
			{icon}
		</Button>
	)
}

export function IconSidebar() {
	const handleAddFeed = () => {
		console.log('Add new feed')
	}

	const handleSettings = () => {
		console.log('Open settings')
	}

	return (
		<aside className="fixed left-0 top-0 h-full w-[50px] lg:w-[70px] bg-white border-r border-gray-200 z-40 flex flex-col">
			{/* Top spacing */}
			<div className="h-16" />

			{/* Navigation icons */}
			<nav className="flex-1 flex flex-col items-center pt-2 lg:pt-4 space-y-2 lg:space-y-3">
				<IconButton icon={<Home className="w-5 h-5 lg:w-6 lg:h-6" />} active={true} />
				<IconButton icon={<Plus className="w-5 h-5 lg:w-6 lg:h-6" />} onClick={handleAddFeed} />
				<IconButton icon={<Bookmark className="w-5 h-5 lg:w-6 lg:h-6" />} />
				<IconButton icon={<Bell className="w-5 h-5 lg:w-6 lg:h-6" />} />
			</nav>

			{/* Settings at bottom */}
			<div className="flex flex-col items-center pb-4 lg:pb-6">
				<IconButton
					icon={<Settings className="w-5 h-5 lg:w-6 lg:h-6" />}
					onClick={handleSettings}
				/>
			</div>
		</aside>
	)
}
