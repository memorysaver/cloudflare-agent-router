import type { Context } from 'hono'
import type { App } from '../context'

/**
 * Session metadata interface
 */
interface SessionMetadata {
	id: string
	createdAt: number
	userAgent?: string
	ipAddress?: string
	lastActivity?: number
}

/**
 * Simple in-memory session storage (could be enhanced with KV storage later)
 */
const sessionStore = new Map<string, SessionMetadata>()

/**
 * Generate a unique session ID using crypto.randomUUID for better uniqueness
 */
function generateSessionId(): string {
	// Use crypto.randomUUID() if available (Cloudflare Workers supports it)
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID()
	}
	// Fallback to timestamp + random for better uniqueness than just Math.random()
	const timestamp = Date.now().toString(36)
	const randomPart = Math.random().toString(36).substring(2, 15)
	const randomPart2 = Math.random().toString(36).substring(2, 15)
	return `${timestamp}-${randomPart}-${randomPart2}`
}

/**
 * Validate session ID format
 */
function isValidSessionId(sessionId: string): boolean {
	// UUID format (with crypto.randomUUID) or timestamp-based fallback format
	const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
	const fallbackPattern = /^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/i
	return uuidPattern.test(sessionId) || fallbackPattern.test(sessionId)
}

/**
 * Create session metadata and store it
 */
function createSessionMetadata(c: Context<App>, sessionId: string): SessionMetadata {
	const metadata: SessionMetadata = {
		id: sessionId,
		createdAt: Date.now(),
		userAgent: c.req.header('user-agent'),
		ipAddress: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for'),
		lastActivity: Date.now()
	}
	
	sessionStore.set(sessionId, metadata)
	return metadata
}

/**
 * Update session activity
 */
function updateSessionActivity(sessionId: string): void {
	const metadata = sessionStore.get(sessionId)
	if (metadata) {
		metadata.lastActivity = Date.now()
		sessionStore.set(sessionId, metadata)
	}
}

/**
 * Serve the demo interface HTML page
 */
export async function handleDemo(c: Context<App>): Promise<Response> {
	// Check if we have a session ID in the URL
	const sessionId = c.req.param('sessionId')

	// If no session ID, create new one and redirect
	if (!sessionId) {
		const newSessionId = generateSessionId()
		console.log(`📝 Creating new demo session: ${newSessionId}`)
		
		// Create session metadata
		createSessionMetadata(c, newSessionId)
		
		// Use 302 redirect for better UX (temporary redirect)
		return c.redirect(`/demo/${newSessionId}`, 302)
	}

	// Validate session ID format
	if (!isValidSessionId(sessionId)) {
		console.warn(`⚠️ Invalid session ID format: ${sessionId}`)
		// Redirect to new session instead of showing error
		const newSessionId = generateSessionId()
		console.log(`🔄 Redirecting invalid session to new session: ${newSessionId}`)
		createSessionMetadata(c, newSessionId)
		return c.redirect(`/demo/${newSessionId}`, 302)
	}

	// Update session activity
	updateSessionActivity(sessionId)
	console.log(`🎯 Serving demo interface for session: ${sessionId}`)
	const html = `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Claude Code Agent Demo</title>
	<script src="https://cdn.tailwindcss.com"></script>
	<script>
		tailwind.config = {
			theme: {
				extend: {
					colors: {
						'claude': {
							50: '#fdf8f3',
							100: '#faeee0',
							500: '#d97706',
							600: '#c2410c',
							700: '#9a3412',
						},
						'chat': {
							'user': '#2563eb',
							'assistant': '#f3f4f6',
							'error': '#dc2626',
							'tool': '#1d4ed8',
							'file': '#166534'
						}
					}
				}
			}
		}
	</script>
	<style>
		@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
		
		.glass-effect {
			backdrop-filter: blur(8px);
			background: rgba(255, 255, 255, 0.95);
		}
		
		.gradient-bg {
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		}
		
		.message-animation {
			animation: slideIn 0.3s ease-out;
		}
		
		@keyframes slideIn {
			from {
				opacity: 0;
				transform: translateY(10px);
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}
		
		.typing-dots {
			animation: pulse 1.5s ease-in-out infinite;
		}
		
		.hover-scale {
			transition: transform 0.2s ease-in-out;
		}
		
		.hover-scale:hover {
			transform: scale(1.05);
		}
	</style>
</head>
<body class="font-inter bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
	<!-- Header -->
	<header class="gradient-bg text-white shadow-2xl">
		<div class="max-w-7xl mx-auto px-6 py-6">
			<div class="flex items-center space-x-4">
				<div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
					<svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
					</svg>
				</div>
				<div>
					<h1 class="text-3xl font-bold">Claude Code Agent</h1>
					<p class="text-blue-100 mt-1">WebSocket-based real-time AI communication</p>
				</div>
			</div>
		</div>
	</header>

	<main class="max-w-7xl mx-auto px-6 py-8 space-y-6">
		<!-- Session Info and Model Selection Card -->
		<div class="glass-effect rounded-2xl shadow-lg border border-white/20 p-4">
			<!-- Desktop Layout -->
			<div class="hidden sm:flex items-center justify-between gap-4">
				<!-- Session Info -->
				<div class="flex items-center space-x-2">
					<div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
						<svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
						</svg>
					</div>
					<div>
						<p class="text-xs font-medium text-gray-500">Session</p>
						<code id="session-id" class="text-sm font-mono font-semibold text-blue-700">${sessionId}</code>
					</div>
				</div>

				<!-- Model Selection -->
				<div class="flex items-center space-x-2">
					<div class="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
						<svg class="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
						</svg>
					</div>
					<div class="flex items-center space-x-2">
						<div>
							<p class="text-xs font-medium text-gray-500">Model</p>
							<p id="current-model" class="text-sm font-semibold text-purple-700">groq/openai/gpt-oss-120b</p>
						</div>
						<select id="model-dropdown" onchange="changeModel()" class="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 min-w-[160px]">
							<option value="groq/openai/gpt-oss-120b">Groq GPT-OSS-120B</option>
							<option value="groq/openai/gpt-oss-20b">Groq GPT-OSS-20B</option>
							<option value="groq/moonshotai/kimi-k2-instruct">Groq Kimi K2 Instruct</option>
							<option value="openrouter/z-ai/glm-4.5-air">OpenRouter GLM-4.5-Air</option>
							<option value="openrouter/z-ai/glm-4.5">OpenRouter GLM-4.5</option>
							<option value="openrouter/qwen/qwen3-coder">OpenRouter Qwen3 Coder</option>
						</select>
					</div>
				</div>

				<!-- Action Buttons -->
				<div class="flex space-x-2">
					<button onclick="copySessionUrl()" class="hover-scale inline-flex items-center px-3 py-1.5 bg-gray-600 text-white rounded-lg text-sm font-medium transition-all duration-200 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2">
						<svg class="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
						</svg>
						Copy
					</button>
					<a href="/demo" class="hover-scale inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
						<svg class="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
						</svg>
						New
					</a>
				</div>
			</div>

			<!-- Mobile Layout -->
			<div class="sm:hidden space-y-4">
				<!-- Session Info Row -->
				<div class="flex items-center justify-between">
					<div class="flex items-center space-x-2">
						<div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
							<svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
							</svg>
						</div>
						<div>
							<p class="text-xs font-medium text-gray-500">Session</p>
							<code id="session-id-mobile" class="text-sm font-mono font-semibold text-blue-700">${sessionId}</code>
						</div>
					</div>
					<!-- Action Buttons -->
					<div class="flex space-x-2">
						<button onclick="copySessionUrl()" class="hover-scale inline-flex items-center px-2 py-1 bg-gray-600 text-white rounded-lg text-xs font-medium transition-all duration-200 hover:bg-gray-700">
							<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
							</svg>
						</button>
						<a href="/demo" class="hover-scale inline-flex items-center px-2 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium transition-all duration-200 hover:bg-blue-700">
							<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
							</svg>
						</a>
					</div>
				</div>

				<!-- Model Selection Row -->
				<div class="flex items-center space-x-2">
					<div class="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
						<svg class="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
						</svg>
					</div>
					<div class="flex-1 min-w-0">
						<p class="text-xs font-medium text-gray-500">AI Model</p>
						<select id="model-dropdown-mobile" onchange="changeModel()" class="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200">
							<option value="groq/openai/gpt-oss-120b">Groq GPT-OSS-120B</option>
							<option value="groq/openai/gpt-oss-20b">Groq GPT-OSS-20B</option>
							<option value="groq/moonshotai/kimi-k2-instruct">Groq Kimi K2 Instruct</option>
							<option value="openrouter/z-ai/glm-4.5-air">OpenRouter GLM-4.5-Air</option>
							<option value="openrouter/z-ai/glm-4.5">OpenRouter GLM-4.5</option>
							<option value="openrouter/qwen/qwen3-coder">OpenRouter Qwen3 Coder</option>
						</select>
					</div>
				</div>
			</div>
		</div>

		<!-- Chat Container -->
		<div class="glass-effect rounded-2xl shadow-xl border border-white/20 overflow-hidden flex flex-col h-[600px]">
			<!-- Messages Area -->
			<div id="messages" class="flex-1 p-6 overflow-y-auto space-y-4 bg-gradient-to-b from-transparent to-gray-50/30">
				<!-- Messages will be inserted here -->
			</div>
			
			<!-- Input Area with Integrated Status -->
			<div class="border-t border-gray-200/50 bg-white/50 backdrop-blur-sm p-6 space-y-3">
				<!-- Status Bar -->
				<div id="status" class="flex items-center justify-between">
					<div class="flex items-center space-x-3">
						<div class="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" id="status-indicator"></div>
						<div>
							<span class="text-sm font-medium text-gray-700">Status:</span>
							<span id="status-text" class="ml-1 text-sm text-gray-600">Connecting...</span>
						</div>
					</div>
					<div class="text-xs text-gray-500" id="connection-hint">
						You can type while disconnected
					</div>
				</div>
				
				<!-- Input Form -->
				<form id="message-form" class="flex space-x-4">
					<div class="flex-1 relative">
						<input 
							id="message-input" 
							type="text" 
							placeholder="Type your message to Claude Code..." 
							class="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm disabled:bg-gray-50 disabled:text-gray-500"
						>
						<div class="absolute inset-y-0 right-0 flex items-center pr-3">
							<svg id="input-icon" class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
							</svg>
						</div>
					</div>
					<button 
						id="send-button" 
						type="submit" 
						class="hover-scale inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl font-medium transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none"
					>
						<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
						</svg>
						<span id="send-button-text">Send</span>
					</button>
				</form>
			</div>
		</div>
	</main>

	<!-- Footer -->
	<footer class="max-w-7xl mx-auto px-6 py-6">
		<div class="text-center text-sm text-gray-500">
			<div class="flex items-center justify-center space-x-2">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
				</svg>
				<span>Powered by <strong>Claude Code Agent</strong> on Cloudflare Workers</span>
			</div>
		</div>
	</footer>

	<script>
		let ws = null;
		let isConnected = false;
		const sessionId = '${sessionId}';
		let currentModel = localStorage.getItem(\`model_\${sessionId}\`) || 'groq/openai/gpt-oss-120b';

		const statusEl = document.getElementById('status');
		const statusTextEl = document.getElementById('status-text');
		const statusIndicator = document.getElementById('status-indicator');
		const connectionHint = document.getElementById('connection-hint');
		const messagesEl = document.getElementById('messages');
		const messageForm = document.getElementById('message-form');
		const messageInput = document.getElementById('message-input');
		const sendButton = document.getElementById('send-button');
		const sendButtonText = document.getElementById('send-button-text');
		const inputIcon = document.getElementById('input-icon');
		const modelDropdown = document.getElementById('model-dropdown');
		const modelDropdownMobile = document.getElementById('model-dropdown-mobile');
		const currentModelEl = document.getElementById('current-model');

		let pendingMessages = []; // Store messages while disconnected

		function copySessionUrl() {
			const url = window.location.href;
			navigator.clipboard.writeText(url).then(() => {
				const originalText = event.target.textContent;
				event.target.textContent = 'Copied!';
				setTimeout(() => {
					event.target.textContent = originalText;
				}, 2000);
			}).catch(err => {
				console.error('Failed to copy URL:', err);
			});
		}

		function changeModel() {
			// Get the new model from whichever dropdown triggered the change
			const newModel = modelDropdown ? modelDropdown.value : modelDropdownMobile.value;
			currentModel = newModel;
			if (currentModelEl) currentModelEl.textContent = newModel;
			
			// Sync both dropdowns
			if (modelDropdown) modelDropdown.value = newModel;
			if (modelDropdownMobile) modelDropdownMobile.value = newModel;
			
			// Save model preference for this session
			localStorage.setItem(\`model_\${sessionId}\`, newModel);
			
			// Show model change notification
			updateStatus(\`Model changed to: \${newModel}\`);
			setTimeout(() => {
				if (isConnected) {
					updateStatus('Connected to Claude Code Agent');
				}
			}, 2000);
		}

		function initializeModel() {
			// Set both dropdowns to saved model
			if (modelDropdown) modelDropdown.value = currentModel;
			if (modelDropdownMobile) modelDropdownMobile.value = currentModel;
			if (currentModelEl) currentModelEl.textContent = currentModel;
		}

		function updateStatus(text, isError = false, addToChat = false) {
			statusTextEl.textContent = text;
			
			// Add status changes to chat history if requested
			if (addToChat) {
				addStatusMessage(text, isError);
			}
			
			if (isError) {
				statusIndicator.className = 'w-3 h-3 bg-red-400 rounded-full animate-pulse';
				connectionHint.textContent = 'Reconnecting... You can still type messages';
				sendButtonText.textContent = 'Queue';
				inputIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.70-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>';
			} else if (isConnected) {
				statusIndicator.className = 'w-3 h-3 bg-green-400 rounded-full animate-pulse';
				connectionHint.textContent = '';
				sendButtonText.textContent = 'Send';
				inputIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>';
				
				// Send any pending messages
				if (pendingMessages.length > 0) {
					connectionHint.textContent = \`Sending \${pendingMessages.length} queued message(s)...\`;
					addStatusMessage(\`Sending \${pendingMessages.length} queued message(s)...\`, false);
					pendingMessages.forEach(message => sendMessage(message, true));
					pendingMessages = [];
					setTimeout(() => {
						connectionHint.textContent = '';
					}, 2000);
				}
			} else {
				statusIndicator.className = 'w-3 h-3 bg-yellow-400 rounded-full animate-pulse';
				connectionHint.textContent = 'You can type while disconnected';
				sendButtonText.textContent = 'Queue';
				inputIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>';
			}
		}

		function addStatusMessage(text, isError = false) {
			const messageEl = document.createElement('div');
			messageEl.className = 'message-animation max-w-2xl mx-auto';
			
			let statusClasses = 'px-3 py-2 rounded-full text-xs font-medium border ';
			let iconSvg = '';
			
			if (isError) {
				statusClasses += 'bg-red-50 text-red-700 border-red-200';
				iconSvg = '<svg class="w-3 h-3 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path></svg>';
			} else if (text.includes('Connected')) {
				statusClasses += 'bg-green-50 text-green-700 border-green-200';
				iconSvg = '<svg class="w-3 h-3 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
			} else if (text.includes('Sending')) {
				statusClasses += 'bg-blue-50 text-blue-700 border-blue-200';
				iconSvg = '<svg class="w-3 h-3 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>';
			} else {
				statusClasses += 'bg-yellow-50 text-yellow-700 border-yellow-200';
				iconSvg = '<svg class="w-3 h-3 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
			}
			
			messageEl.innerHTML = \`
				<div class="text-center">
					<div class="\${statusClasses}">
						<div class="flex items-center justify-center">
							\${iconSvg}
							<span>\${text}</span>
						</div>
					</div>
				</div>
			\`;

			messagesEl.appendChild(messageEl);
			messagesEl.scrollTop = messagesEl.scrollHeight;
		}

		function addMessage(content, role = 'assistant', type = 'result', timestamp = Date.now()) {
			const messageEl = document.createElement('div');
			messageEl.className = 'message-animation max-w-4xl';
			
			// Message styling based on role and type
			let messageClasses = 'p-4 rounded-2xl shadow-sm border ';
			let iconSvg = '';
			
			if (role === 'user') {
				messageClasses += 'bg-blue-600 text-white ml-auto border-blue-600';
				iconSvg = '<svg class="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>';
			} else if (type === 'error') {
				messageClasses += 'bg-red-50 text-red-800 border-red-200';
				iconSvg = '<svg class="w-5 h-5 mr-2 flex-shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
			} else if (type === 'tool_use') {
				messageClasses += 'bg-blue-50 text-blue-800 border-blue-200';
				iconSvg = '<svg class="w-5 h-5 mr-2 flex-shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>';
			} else if (type === 'file_change') {
				messageClasses += 'bg-green-50 text-green-800 border-green-200';
				iconSvg = '<svg class="w-5 h-5 mr-2 flex-shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>';
			} else {
				messageClasses += 'bg-white text-gray-800 border-gray-200';
				iconSvg = '<svg class="w-5 h-5 mr-2 flex-shrink-0 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>';
			}
			
			messageEl.className += ' ' + messageClasses;
			
			// Create message content
			messageEl.innerHTML = \`
				<div class="flex items-start space-x-3">
					\${iconSvg}
					<div class="flex-1 min-w-0">
						<div class="break-words whitespace-pre-wrap">\${content}</div>
						<div class="text-xs opacity-75 mt-2">
							\${new Date(timestamp).toLocaleTimeString()} • \${type.replace('_', ' ').toUpperCase()}
						</div>
					</div>
				</div>
			\`;

			messagesEl.appendChild(messageEl);
			messagesEl.scrollTop = messagesEl.scrollHeight;
		}

		function connectWebSocket() {
			const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
			const wsUrl = \`\${protocol}//\${window.location.host}/demo/ws/\${sessionId}\`;
			
			updateStatus('Connecting...');
			
			ws = new WebSocket(wsUrl);

			ws.onopen = function(event) {
				isConnected = true;
				updateStatus('Connected', false, true);
				messageInput.disabled = false;
				sendButton.disabled = false;
				messageInput.focus();
			};

			ws.onmessage = function(event) {
				try {
					const message = JSON.parse(event.data);
					console.log('Received:', message);

					// Remove typing indicator when we get actual responses
					const typingIndicator = document.getElementById('typing-indicator');
					if (typingIndicator && (message.type === 'result' || message.type === 'error' || message.type === 'tool_use' || message.type === 'file_change')) {
						typingIndicator.remove();
					}

					if (message.type === 'status') {
						updateStatus(message.content);
					} else if (message.type === 'error') {
						updateStatus(message.content, true);
						addMessage(message.content, 'assistant', 'error', message.timestamp);
					} else if (message.content) {
						addMessage(message.content, 'assistant', message.type || 'result', message.timestamp);
					}
				} catch (error) {
					console.error('Error parsing WebSocket message:', error);
				}
			};

			ws.onclose = function(event) {
				isConnected = false;
				updateStatus('Connection closed. Attempting to reconnect...', true, true);
				messageInput.disabled = false; // Allow typing while disconnected
				sendButton.disabled = false; // Allow queuing messages
				
				// Reconnect after 3 seconds
				setTimeout(connectWebSocket, 3000);
			};

			ws.onerror = function(error) {
				console.error('WebSocket error:', error);
				updateStatus('Connection error', true);
			};
		}

		function sendMessage(content, isFromQueue = false) {
			if (!isConnected || !ws) {
				if (!isFromQueue) {
					// Queue the message for when we reconnect
					pendingMessages.push(content);
					addMessage(content, 'user', 'message');
					addStatusMessage(\`Message queued - will send when connected (\${pendingMessages.length} pending)\`, false);
					return;
				} else {
					// This is from the queue but we're still not connected
					updateStatus('Still not connected', true);
					return;
				}
			}

			// Add user message to chat (if not from queue, already added)
			if (isFromQueue) {
				addMessage(content, 'user', 'message');
			} else {
				addMessage(content, 'user', 'message');
			}

			// Send to agent with model parameter
			ws.send(JSON.stringify({
				type: 'user_message',
				content: content,
				model: currentModel,
				timestamp: Date.now()
			}));

			// Show typing indicator
			const typingEl = document.createElement('div');
			typingEl.className = 'message-animation max-w-4xl p-4 rounded-2xl shadow-sm border bg-gray-50 text-gray-600 border-gray-200';
			typingEl.innerHTML = \`
				<div class="flex items-center space-x-3">
					<svg class="w-5 h-5 text-purple-500 typing-dots" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
					</svg>
					<div class="flex space-x-1">
						<div class="text-sm italic">Claude Code is thinking</div>
						<div class="flex space-x-1 ml-2">
							<div class="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style="animation-delay: 0s"></div>
							<div class="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
							<div class="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
						</div>
					</div>
				</div>
			\`;
			typingEl.id = 'typing-indicator';
			messagesEl.appendChild(typingEl);
			messagesEl.scrollTop = messagesEl.scrollHeight;
		}

		// Initialize
		messageForm.addEventListener('submit', function(e) {
			e.preventDefault();
			const message = messageInput.value.trim();
			if (message) {
				sendMessage(message);
				messageInput.value = '';
			}
		});

		// Initialize model selection on page load
		initializeModel();
		
		// Connect on page load
		connectWebSocket();

		// Handle page visibility for reconnection
		document.addEventListener('visibilitychange', function() {
			if (document.visibilityState === 'visible' && !isConnected) {
				connectWebSocket();
			}
		});
	</script>
</body>
</html>`

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
		},
	})
}

/**
 * Handle session health check and analytics
 */
export async function handleDemoHealth(c: Context<App>): Promise<Response> {
	const now = Date.now()
	const activeThreshold = 30 * 60 * 1000 // 30 minutes
	
	// Clean up old sessions (older than 30 minutes of inactivity)
	for (const [sessionId, metadata] of sessionStore.entries()) {
		if (metadata.lastActivity && (now - metadata.lastActivity) > activeThreshold) {
			sessionStore.delete(sessionId)
		}
	}
	
	// Get active sessions
	const activeSessions = Array.from(sessionStore.values()).filter(
		metadata => metadata.lastActivity && (now - metadata.lastActivity) <= activeThreshold
	)
	
	const stats = {
		totalSessions: sessionStore.size,
		activeSessions: activeSessions.length,
		activeSessionsData: activeSessions.map(session => ({
			id: session.id.substring(0, 8) + '...',  // Truncate for privacy
			createdAt: new Date(session.createdAt).toISOString(),
			lastActivity: session.lastActivity ? new Date(session.lastActivity).toISOString() : null,
			userAgent: session.userAgent?.substring(0, 50) + '...' || 'Unknown'
		})),
		timestamp: new Date(now).toISOString()
	}
	
	return c.json(stats)
}
