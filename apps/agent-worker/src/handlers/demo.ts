import type { Context } from 'hono'
import type { App } from '../context'

/**
 * Serve the demo interface HTML page
 */
export async function handleDemo(c: Context<App>): Promise<Response> {
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
	</style>
</head>
<body>
	<div class="header">
		<h1>🤖 Claude Code Agent Demo</h1>
		<p>WebSocket-based real-time communication with Claude Code</p>
	</div>

	<div class="container">
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

		const statusEl = document.getElementById('status');
		const statusTextEl = document.getElementById('status-text');
		const messagesEl = document.getElementById('messages');
		const messageForm = document.getElementById('message-form');
		const messageInput = document.getElementById('message-input');
		const sendButton = document.getElementById('send-button');

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
			const wsUrl = \`\${protocol}//\${window.location.host}/demo/ws\`;
			
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

			// Send to agent
			ws.send(JSON.stringify({
				type: 'user_message',
				content: content,
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
</html>`;

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
		},
	})
}