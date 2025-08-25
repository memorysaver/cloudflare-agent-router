import type { Context } from 'hono'
import type { App } from '../context'

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
	return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
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
		return c.redirect(`/demo/${newSessionId}`)
	}
	const html = `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Claude Code Agent Demo</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}

		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			background-color: #f5f5f5;
			height: 100vh;
			display: flex;
			flex-direction: column;
		}

		.header {
			background: #2563eb;
			color: white;
			padding: 1rem 2rem;
			box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		}

		.header h1 {
			font-size: 1.5rem;
			font-weight: 600;
		}

		.header p {
			opacity: 0.9;
			margin-top: 0.25rem;
		}

		.container {
			flex: 1;
			display: flex;
			flex-direction: column;
			max-width: 1200px;
			margin: 0 auto;
			width: 100%;
			padding: 2rem;
			gap: 1rem;
		}

		.status {
			background: white;
			padding: 1rem;
			border-radius: 8px;
			border-left: 4px solid #10b981;
			box-shadow: 0 1px 3px rgba(0,0,0,0.1);
		}

		.status.error {
			border-left-color: #ef4444;
		}

		.chat-container {
			flex: 1;
			background: white;
			border-radius: 8px;
			box-shadow: 0 1px 3px rgba(0,0,0,0.1);
			display: flex;
			flex-direction: column;
			overflow: hidden;
		}

		.messages {
			flex: 1;
			padding: 1rem;
			overflow-y: auto;
			display: flex;
			flex-direction: column;
			gap: 1rem;
		}

		.message {
			max-width: 80%;
			padding: 0.75rem 1rem;
			border-radius: 8px;
			word-wrap: break-word;
		}

		.message.user {
			background: #2563eb;
			color: white;
			align-self: flex-end;
		}

		.message.assistant {
			background: #f3f4f6;
			color: #374151;
			align-self: flex-start;
		}

		.message.error {
			background: #fef2f2;
			color: #dc2626;
			border: 1px solid #fecaca;
			align-self: flex-start;
		}

		.message.tool_use {
			background: #eff6ff;
			color: #1d4ed8;
			border: 1px solid #dbeafe;
			align-self: flex-start;
		}

		.message.file_change {
			background: #f0fdf4;
			color: #166534;
			border: 1px solid #bbf7d0;
			align-self: flex-start;
		}

		.message-meta {
			font-size: 0.75rem;
			opacity: 0.7;
			margin-top: 0.25rem;
		}

		.input-container {
			padding: 1rem;
			border-top: 1px solid #e5e7eb;
			background: #f9fafb;
		}

		.input-form {
			display: flex;
			gap: 0.5rem;
		}

		.input-field {
			flex: 1;
			padding: 0.75rem;
			border: 1px solid #d1d5db;
			border-radius: 6px;
			font-size: 1rem;
		}

		.input-field:focus {
			outline: none;
			border-color: #2563eb;
			box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
		}

		.send-button {
			background: #2563eb;
			color: white;
			border: none;
			padding: 0.75rem 1.5rem;
			border-radius: 6px;
			cursor: pointer;
			font-weight: 500;
		}

		.send-button:hover:not(:disabled) {
			background: #1d4ed8;
		}

		.send-button:disabled {
			background: #9ca3af;
			cursor: not-allowed;
		}

		.typing-indicator {
			padding: 0.5rem 1rem;
			background: #f3f4f6;
			color: #6b7280;
			border-radius: 8px;
			align-self: flex-start;
			font-style: italic;
		}

		.session-info {
			background: #eff6ff;
			border: 1px solid #dbeafe;
			padding: 1rem;
			border-radius: 8px;
			margin-bottom: 1rem;
			display: flex;
			justify-content: space-between;
			align-items: center;
		}

		.session-details {
			font-size: 0.875rem;
			color: #1e40af;
		}

		.session-controls {
			display: flex;
			gap: 0.5rem;
		}

		.btn {
			background: #2563eb;
			color: white;
			border: none;
			padding: 0.5rem 1rem;
			border-radius: 4px;
			cursor: pointer;
			font-size: 0.875rem;
			text-decoration: none;
			display: inline-block;
		}

		.btn:hover {
			background: #1d4ed8;
		}

		.btn.secondary {
			background: #6b7280;
		}

		.btn.secondary:hover {
			background: #4b5563;
		}

		.model-selection {
			background: #f0f9ff;
			border: 1px solid #bae6fd;
			padding: 1rem;
			border-radius: 8px;
			margin-bottom: 1rem;
			display: flex;
			justify-content: space-between;
			align-items: center;
		}

		.model-details {
			font-size: 0.875rem;
			color: #0c4a6e;
		}

		.model-dropdown {
			background: white;
			border: 1px solid #d1d5db;
			border-radius: 6px;
			padding: 0.5rem;
			font-size: 0.875rem;
			cursor: pointer;
			min-width: 200px;
		}

		.model-dropdown:focus {
			outline: none;
			border-color: #2563eb;
			box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
		}
	</style>
</head>
<body>
	<div class="header">
		<h1>🤖 Claude Code Agent Demo</h1>
		<p>WebSocket-based real-time communication with Claude Code</p>
	</div>

	<div class="container">
		<div class="session-info">
			<div class="session-details">
				<strong>Session ID:</strong> <code id="session-id">${sessionId}</code>
			</div>
			<div class="session-controls">
				<button class="btn secondary" onclick="copySessionUrl()">Copy URL</button>
				<a href="/demo" class="btn">New Session</a>
			</div>
		</div>

		<div class="model-selection">
			<div class="model-details">
				<strong>Model:</strong> <span id="current-model">groq/openai/gpt-oss-120b</span>
			</div>
			<select id="model-dropdown" class="model-dropdown" onchange="changeModel()">
				<option value="groq/openai/gpt-oss-120b">Groq GPT-OSS-120B</option>
				<option value="groq/openai/gpt-oss-20b">Groq GPT-OSS-20B</option>
				<option value="groq/moonshotai/kimi-k2-instruct">Groq Kimi K2 Instruct</option>
				<option value="openrouter/z-ai/glm-4.5-air">OpenRouter GLM-4.5-Air</option>
				<option value="openrouter/z-ai/glm-4.5">OpenRouter GLM-4.5</option>
				<option value="openrouter/qwen/qwen3-coder">OpenRouter Qwen3 Coder</option>
			</select>
		</div>

		<div id="status" class="status">
			<strong>Status:</strong> <span id="status-text">Connecting...</span>
		</div>

		<div class="chat-container">
			<div id="messages" class="messages">
				<!-- Messages will be inserted here -->
			</div>
			
			<div class="input-container">
				<form id="message-form" class="input-form">
					<input 
						id="message-input" 
						class="input-field" 
						type="text" 
						placeholder="Type your message to Claude Code..." 
						disabled
					>
					<button id="send-button" class="send-button" type="submit" disabled>
						Send
					</button>
				</form>
			</div>
		</div>
	</div>

	<script>
		let ws = null;
		let isConnected = false;
		const sessionId = '${sessionId}';
		let currentModel = localStorage.getItem(\`model_\${sessionId}\`) || 'groq/openai/gpt-oss-120b';

		const statusEl = document.getElementById('status');
		const statusTextEl = document.getElementById('status-text');
		const messagesEl = document.getElementById('messages');
		const messageForm = document.getElementById('message-form');
		const messageInput = document.getElementById('message-input');
		const sendButton = document.getElementById('send-button');
		const modelDropdown = document.getElementById('model-dropdown');
		const currentModelEl = document.getElementById('current-model');

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
			const newModel = modelDropdown.value;
			currentModel = newModel;
			currentModelEl.textContent = newModel;
			
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
			// Set dropdown to saved model
			modelDropdown.value = currentModel;
			currentModelEl.textContent = currentModel;
		}

		function updateStatus(text, isError = false) {
			statusTextEl.textContent = text;
			statusEl.className = \`status \${isError ? 'error' : ''}\`;
		}

		function addMessage(content, role = 'assistant', type = 'result', timestamp = Date.now()) {
			const messageEl = document.createElement('div');
			messageEl.className = \`message \${role} \${type}\`;
			
			const contentEl = document.createElement('div');
			contentEl.textContent = content;
			messageEl.appendChild(contentEl);

			const metaEl = document.createElement('div');
			metaEl.className = 'message-meta';
			metaEl.textContent = \`\${new Date(timestamp).toLocaleTimeString()} • \${type}\`;
			messageEl.appendChild(metaEl);

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
				updateStatus('Connected to Claude Code Agent');
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
				updateStatus('Connection closed. Attempting to reconnect...', true);
				messageInput.disabled = true;
				sendButton.disabled = true;
				
				// Reconnect after 3 seconds
				setTimeout(connectWebSocket, 3000);
			};

			ws.onerror = function(error) {
				console.error('WebSocket error:', error);
				updateStatus('Connection error', true);
			};
		}

		function sendMessage(content) {
			if (!isConnected || !ws) {
				updateStatus('Not connected', true);
				return;
			}

			// Add user message to chat
			addMessage(content, 'user', 'message');

			// Send to agent with model parameter
			ws.send(JSON.stringify({
				type: 'user_message',
				content: content,
				model: currentModel,
				timestamp: Date.now()
			}));

			// Show typing indicator
			const typingEl = document.createElement('div');
			typingEl.className = 'typing-indicator';
			typingEl.textContent = 'Claude Code is thinking...';
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
