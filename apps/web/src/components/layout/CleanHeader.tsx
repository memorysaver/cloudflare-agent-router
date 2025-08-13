import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

interface CleanHeaderProps {
	searchQuery: string
	onSearchChange: (query: string) => void
}

export function CleanHeader({ searchQuery, onSearchChange }: CleanHeaderProps) {
	return (
		<header className="sticky top-0 z-50 w-full bg-white border-b border-gray-200">
			<div className="flex items-center justify-between h-16 px-4 max-w-7xl mx-auto">
				{/* Left spacer for balance */}
				<div className="w-10 lg:w-16" />

				{/* Center search bar */}
				<div className="flex-1 max-w-2xl mx-4">
					<div className="relative">
						<Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
						<Input
							placeholder="Search news..."
							value={searchQuery}
							onChange={(e) => onSearchChange(e.target.value)}
							className="w-full pl-12 pr-4 h-12 bg-gray-50 border-0 rounded-full text-base placeholder:text-gray-500 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
						/>
					</div>
				</div>

				{/* Right profile */}
				<div className="flex items-center">
					<Avatar className="w-8 h-8 cursor-pointer hover:ring-2 hover:ring-blue-500 hover:ring-offset-2 transition-all">
						<AvatarFallback className="bg-blue-600 text-white text-sm font-medium">
							JD
						</AvatarFallback>
					</Avatar>
				</div>
			</div>
		</header>
	)
}
