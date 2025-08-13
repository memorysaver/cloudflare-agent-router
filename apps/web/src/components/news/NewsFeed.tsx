import { mockNewsData } from '@/data/mockNews'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'

import { MasonryGrid } from './MasonryGrid'
import { NewsCard } from './NewsCard'

import type { MockNewsItem } from '@/data/mockNews'

interface NewsFeedProps {
	searchQuery?: string
}

export function NewsFeed({ searchQuery = '' }: NewsFeedProps) {
	const [filteredNews, setFilteredNews] = useState<MockNewsItem[]>(mockNewsData)

	useEffect(() => {
		if (searchQuery.trim()) {
			const filtered = mockNewsData.filter(
				(item) =>
					item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
					item.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
					item.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
			)
			setFilteredNews(filtered)
		} else {
			setFilteredNews(mockNewsData)
		}
	}, [searchQuery])

	const handleSave = (id: string) => {
		console.log('Saving article:', id)
		// Here you would typically update the saved state in your data store
	}

	const handleShare = (id: string) => {
		console.log('Sharing article:', id)
		// Here you would typically implement sharing functionality
	}

	return (
		<div className="p-4 lg:p-6">
			<div className="max-w-7xl mx-auto">
				{filteredNews.length === 0 ? (
					<div className="text-center py-12">
						<div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
							<Search className="w-6 h-6 text-gray-400" />
						</div>
						<h3 className="text-lg font-medium text-gray-900 mb-2">No articles found</h3>
						<p className="text-gray-500">Try adjusting your search terms to find more content.</p>
					</div>
				) : (
					<MasonryGrid>
						{filteredNews.map((item) => (
							<NewsCard key={item.id} item={item} onSave={handleSave} onShare={handleShare} />
						))}
					</MasonryGrid>
				)}
			</div>
		</div>
	)
}
