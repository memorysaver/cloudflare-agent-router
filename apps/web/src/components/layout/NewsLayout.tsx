import { useState } from 'react'

import { CleanHeader } from './CleanHeader'
import { IconSidebar } from './IconSidebar'

import type { ReactNode } from 'react'

interface NewsLayoutProps {
	children: ReactNode | ((props: { searchQuery: string }) => ReactNode)
}

export function NewsLayout({ children }: NewsLayoutProps) {
	const [searchQuery, setSearchQuery] = useState('')

	return (
		<div className="min-h-screen bg-white">
			<IconSidebar />
			<div className="pl-[50px] lg:pl-[70px]">
				<CleanHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} />
				<main className="bg-gray-50">
					{typeof children === 'function' ? children({ searchQuery }) : children}
				</main>
			</div>
		</div>
	)
}
