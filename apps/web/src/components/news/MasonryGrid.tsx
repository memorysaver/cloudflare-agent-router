import { useEffect, useRef, useState } from 'react'

import type { ReactNode } from 'react'

interface MasonryGridProps {
	children: ReactNode[]
	gap?: number
}

export function MasonryGrid({ children, gap = 16 }: MasonryGridProps) {
	return (
		<div
			className="masonry-grid w-full"
			style={{
				display: 'grid',
				gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
				gridAutoRows: '10px',
				gap: `${gap}px`,
			}}
		>
			{children.map((child, index) => (
				<MasonryItem key={index}>{child}</MasonryItem>
			))}
		</div>
	)
}

interface MasonryItemProps {
	children: ReactNode
}

function MasonryItem({ children }: MasonryItemProps) {
	const itemRef = useRef<HTMLDivElement>(null)
	const [rowSpan, setRowSpan] = useState(30)

	useEffect(() => {
		const resizeObserver = new ResizeObserver(() => {
			if (itemRef.current) {
				const height = itemRef.current.getBoundingClientRect().height
				const span = Math.ceil((height + 10) / 10) // 10px is the grid-auto-rows value
				setRowSpan(span)
			}
		})

		if (itemRef.current) {
			resizeObserver.observe(itemRef.current)
		}

		return () => resizeObserver.disconnect()
	}, [])

	return (
		<div ref={itemRef} className="masonry-item" style={{ gridRowEnd: `span ${rowSpan}` }}>
			{children}
		</div>
	)
}
