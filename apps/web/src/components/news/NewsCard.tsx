import { Card } from '@/components/ui/card'
import { Edit } from 'lucide-react'
import { useState } from 'react'

import type { MockNewsItem } from '@/data/mockNews'

interface NewsCardProps {
	item: MockNewsItem
	onSave?: (id: string) => void
	onShare?: (id: string) => void
}

export function NewsCard({ item, onSave: _onSave, onShare: _onShare }: NewsCardProps) {
	const [isHovered, setIsHovered] = useState(false)

	const getContentQualityColor = (score: number) => {
		if (score >= 80) return 'text-green-500'
		if (score >= 60) return 'text-orange-500'
		return 'text-gray-500'
	}

	return (
		<Card
			className={`group cursor-pointer transition-all duration-300 hover:shadow-lg border-0 bg-white overflow-hidden ${
				isHovered ? 'transform hover:scale-[1.02]' : ''
			}`}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			{/* Featured Image */}
			<div className="relative overflow-hidden">
				<img
					src={item.imageUrl}
					alt={item.title}
					className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
					loading="lazy"
				/>
				{/* Subtle overlay on hover */}
				<div
					className={`absolute inset-0 bg-black bg-opacity-0 transition-all duration-300 ${
						isHovered ? 'bg-opacity-5' : ''
					}`}
				/>
			</div>

			{/* Content */}
			<div className="p-4">
				{/* Title */}
				<h3 className="font-semibold text-base leading-tight mb-3 line-clamp-3 text-gray-900">
					{item.title}
				</h3>

				{/* Summary */}
				<p className="text-sm text-gray-600 line-clamp-3 mb-4 leading-relaxed">{item.excerpt}</p>

				{/* AI Content Generation Indicators */}
				<div className="flex items-center justify-between text-xs">
					{/* AI Content Quality Score */}
					<div className="flex items-center space-x-1">
						<span className={getContentQualityColor(item.aiContentScore)}>✨</span>
						<span className={`font-medium ${getContentQualityColor(item.aiContentScore)}`}>
							{item.aiContentScore}%
						</span>
						<span className="text-gray-400">quality</span>
					</div>

					{/* Generated Outputs Count */}
					<div className="flex items-center space-x-1">
						{item.generatedOutputs.count > 0 ? (
							<>
								<Edit className="w-3 h-3 text-blue-500" />
								<span className="text-blue-500 font-medium">{item.generatedOutputs.count}</span>
								<span className="text-gray-400">generated</span>
							</>
						) : (
							<>
								<Edit className="w-3 h-3 text-gray-300" />
								<span className="text-gray-400">unused</span>
							</>
						)}
					</div>
				</div>
			</div>
		</Card>
	)
}
