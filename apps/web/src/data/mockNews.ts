export interface MockNewsItem {
	id: string
	title: string
	excerpt: string
	imageUrl: string
	source: {
		name: string
		logo: string
		url: string
	}
	category: 'Technology' | 'Business' | 'Sports' | 'Entertainment' | 'Science' | 'Politics'
	publishedAt: Date
	readingTime: number
	isSaved: boolean
	tags: string[]
	engagement: {
		likes: number
		shares: number
		comments: number
	}
	aiContentScore: number // 0-100 AI assessment of content generation quality
	generatedOutputs: {
		count: number // total AI-generated posts from this source
		types: string[] // types of content generated
	}
}

export const mockNewsData: MockNewsItem[] = [
	{
		id: '1',
		title: 'Revolutionary AI Breakthrough: New Language Model Achieves Human-Level Reasoning',
		excerpt:
			'Scientists at leading tech companies have developed an AI system that demonstrates unprecedented reasoning capabilities, potentially transforming how we approach complex problem-solving in various industries.',
		imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=240&fit=crop',
		source: {
			name: 'TechCrunch',
			logo: '🚀',
			url: 'https://techcrunch.com',
		},
		category: 'Technology',
		publishedAt: new Date('2024-01-15T10:30:00Z'),
		readingTime: 5,
		isSaved: false,
		tags: ['AI', 'Machine Learning', 'Innovation'],
		engagement: { likes: 1200, shares: 340, comments: 89 },
		aiContentScore: 92,
		generatedOutputs: {
			count: 7,
			types: ['social-post', 'blog', 'thread', 'newsletter'],
		},
	},
	{
		id: '2',
		title: 'Global Climate Summit Reaches Historic Agreement on Carbon Emissions',
		excerpt:
			'World leaders unite on ambitious climate goals with new framework for international cooperation and sustainable development initiatives.',
		imageUrl: 'https://images.unsplash.com/photo-1569163139394-de4e4f43e4e5?w=400&h=300&fit=crop',
		source: {
			name: 'Reuters',
			logo: '📰',
			url: 'https://reuters.com',
		},
		category: 'Politics',
		publishedAt: new Date('2024-01-15T08:15:00Z'),
		readingTime: 7,
		isSaved: true,
		tags: ['Climate', 'Environment', 'Policy'],
		engagement: { likes: 890, shares: 256, comments: 123 },
		aiContentScore: 78,
		generatedOutputs: {
			count: 3,
			types: ['social-post', 'blog'],
		},
	},
	{
		id: '3',
		title: 'Startup Unicorn: FinTech Company Raises $2B in Series C Funding Round',
		excerpt:
			'The revolutionary payment platform attracts major investors with its innovative approach to cross-border transactions and cryptocurrency integration.',
		imageUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400&h=200&fit=crop',
		source: {
			name: 'Forbes',
			logo: '💼',
			url: 'https://forbes.com',
		},
		category: 'Business',
		publishedAt: new Date('2024-01-15T07:45:00Z'),
		readingTime: 4,
		isSaved: false,
		tags: ['Fintech', 'Startup', 'Investment'],
		engagement: { likes: 567, shares: 178, comments: 45 },
		aiContentScore: 65,
		generatedOutputs: {
			count: 0,
			types: [],
		},
	},
	{
		id: '4',
		title: 'Quantum Computer Breakthrough: Scientists Achieve Error-Free Quantum Calculations',
		excerpt:
			'Major milestone in quantum computing as researchers demonstrate stable quantum operations without decoherence, opening doors to practical quantum applications.',
		imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=280&fit=crop',
		source: {
			name: 'Nature',
			logo: '🔬',
			url: 'https://nature.com',
		},
		category: 'Science',
		publishedAt: new Date('2024-01-14T16:20:00Z'),
		readingTime: 8,
		isSaved: true,
		tags: ['Quantum Computing', 'Research', 'Science'],
		engagement: { likes: 2100, shares: 450, comments: 234 },
		aiContentScore: 88,
		generatedOutputs: {
			count: 5,
			types: ['social-post', 'blog', 'thread'],
		},
	},
	{
		id: '5',
		title: 'Entertainment Giant Announces Next-Gen Streaming Service with VR Integration',
		excerpt:
			'The new platform promises immersive entertainment experiences combining traditional streaming with virtual reality technology.',
		imageUrl: 'https://images.unsplash.com/photo-1593508512255-86ab42a8e620?w=400&h=220&fit=crop',
		source: {
			name: 'Variety',
			logo: '🎬',
			url: 'https://variety.com',
		},
		category: 'Entertainment',
		publishedAt: new Date('2024-01-14T14:30:00Z'),
		readingTime: 3,
		isSaved: false,
		tags: ['Streaming', 'VR', 'Entertainment'],
		engagement: { likes: 734, shares: 192, comments: 67 },
		aiContentScore: 72,
		generatedOutputs: {
			count: 2,
			types: ['social-post'],
		},
	},
	{
		id: '6',
		title: 'Championship Victory: Underdog Team Wins World Series in Historic Comeback',
		excerpt:
			'Against all odds, the team overcame a 3-0 deficit to win the championship in one of the most memorable sports comebacks in recent history.',
		imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&h=320&fit=crop',
		source: {
			name: 'ESPN',
			logo: '⚾',
			url: 'https://espn.com',
		},
		category: 'Sports',
		publishedAt: new Date('2024-01-14T12:00:00Z'),
		readingTime: 6,
		isSaved: false,
		tags: ['Baseball', 'Championship', 'Comeback'],
		engagement: { likes: 3200, shares: 890, comments: 567 },
		aiContentScore: 95,
		generatedOutputs: {
			count: 12,
			types: ['social-post', 'blog', 'thread', 'newsletter', 'infographic'],
		},
	},
	{
		id: '7',
		title: 'Sustainable Energy Milestone: Solar Power Reaches Cost Parity with Fossil Fuels',
		excerpt:
			'New solar technology achieves unprecedented efficiency rates, making renewable energy more cost-effective than traditional energy sources in most markets.',
		imageUrl: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=400&h=180&fit=crop',
		source: {
			name: 'Scientific American',
			logo: '⚡',
			url: 'https://scientificamerican.com',
		},
		category: 'Science',
		publishedAt: new Date('2024-01-14T09:15:00Z'),
		readingTime: 5,
		isSaved: true,
		tags: ['Solar Energy', 'Sustainability', 'Technology'],
		engagement: { likes: 1456, shares: 389, comments: 145 },
		aiContentScore: 82,
		generatedOutputs: {
			count: 4,
			types: ['social-post', 'blog', 'newsletter'],
		},
	},
	{
		id: '8',
		title: 'Market Analysis: Tech Stocks Rally Following Positive Earnings Reports',
		excerpt:
			'Technology sector shows strong performance as major companies exceed quarterly expectations, driving investor confidence and market growth.',
		imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=260&fit=crop',
		source: {
			name: 'Bloomberg',
			logo: '📈',
			url: 'https://bloomberg.com',
		},
		category: 'Business',
		publishedAt: new Date('2024-01-13T18:45:00Z'),
		readingTime: 4,
		isSaved: false,
		tags: ['Stock Market', 'Technology', 'Earnings'],
		engagement: { likes: 892, shares: 234, comments: 78 },
		aiContentScore: 58,
		generatedOutputs: {
			count: 0,
			types: [],
		},
	},
	{
		id: '9',
		title: 'Space Exploration Update: Mars Mission Discovers Evidence of Ancient Water Systems',
		excerpt:
			'Latest data from the Mars rover reveals complex geological formations suggesting the presence of extensive water systems billions of years ago.',
		imageUrl: 'https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=400&h=350&fit=crop',
		source: {
			name: 'NASA News',
			logo: '🚀',
			url: 'https://nasa.gov',
		},
		category: 'Science',
		publishedAt: new Date('2024-01-13T15:30:00Z'),
		readingTime: 9,
		isSaved: true,
		tags: ['Space', 'Mars', 'Discovery'],
		engagement: { likes: 2890, shares: 678, comments: 345 },
		aiContentScore: 91,
		generatedOutputs: {
			count: 8,
			types: ['social-post', 'blog', 'thread', 'newsletter'],
		},
	},
	{
		id: '10',
		title: 'Cybersecurity Alert: New Protocol Enhances Data Protection for Remote Workers',
		excerpt:
			'Security experts develop advanced encryption methods to protect sensitive information in distributed work environments.',
		imageUrl: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400&h=200&fit=crop',
		source: {
			name: 'Wired',
			logo: '🔒',
			url: 'https://wired.com',
		},
		category: 'Technology',
		publishedAt: new Date('2024-01-13T11:20:00Z'),
		readingTime: 6,
		isSaved: false,
		tags: ['Cybersecurity', 'Remote Work', 'Encryption'],
		engagement: { likes: 645, shares: 156, comments: 89 },
		aiContentScore: 69,
		generatedOutputs: {
			count: 2,
			types: ['blog', 'social-post'],
		},
	},
	{
		id: '11',
		title: 'Cultural Renaissance: Independent Film Festival Showcases Emerging Global Talent',
		excerpt:
			'International artists present innovative storytelling techniques that challenge conventional narratives and explore diverse cultural perspectives.',
		imageUrl: 'https://images.unsplash.com/photo-1489599003530-b4c3d0aec1c5?w=400&h=150&fit=crop',
		source: {
			name: 'The Guardian',
			logo: '🎨',
			url: 'https://theguardian.com',
		},
		category: 'Entertainment',
		publishedAt: new Date('2024-01-12T20:10:00Z'),
		readingTime: 7,
		isSaved: false,
		tags: ['Film', 'Culture', 'Arts'],
		engagement: { likes: 423, shares: 98, comments: 34 },
		aiContentScore: 45,
		generatedOutputs: {
			count: 0,
			types: [],
		},
	},
	{
		id: '12',
		title: 'Economic Outlook: Inflation Trends Show Signs of Stabilization Across Major Markets',
		excerpt:
			'Economic indicators suggest a potential turning point as central banks implement strategic monetary policies to address inflation concerns.',
		imageUrl: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=400&h=290&fit=crop',
		source: {
			name: 'Financial Times',
			logo: '💰',
			url: 'https://ft.com',
		},
		category: 'Business',
		publishedAt: new Date('2024-01-12T14:25:00Z'),
		readingTime: 8,
		isSaved: true,
		tags: ['Economy', 'Inflation', 'Policy'],
		engagement: { likes: 1123, shares: 267, comments: 156 },
		aiContentScore: 73,
		generatedOutputs: {
			count: 3,
			types: ['blog', 'newsletter', 'social-post'],
		},
	},
]

// Categories are now AI-controlled, no manual filtering needed

export const sources = [
	{ name: 'TechCrunch', logo: '🚀' },
	{ name: 'Reuters', logo: '📰' },
	{ name: 'Forbes', logo: '💼' },
	{ name: 'Nature', logo: '🔬' },
	{ name: 'Variety', logo: '🎬' },
	{ name: 'ESPN', logo: '⚾' },
	{ name: 'Scientific American', logo: '⚡' },
	{ name: 'Bloomberg', logo: '📈' },
	{ name: 'NASA News', logo: '🚀' },
	{ name: 'Wired', logo: '🔒' },
	{ name: 'The Guardian', logo: '🎨' },
	{ name: 'Financial Times', logo: '💰' },
]
