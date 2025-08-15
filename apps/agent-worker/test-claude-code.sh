#!/bin/bash

# Test script for Claude Code endpoint
# Tests the /claude-code endpoint with a simple prompt

echo "🧪 Testing Claude Code endpoint..."

# Check if server is running on port 8787
echo "🔍 Checking if agent-worker is running on port 8788..."
curl -s http://localhost:8788/ > /dev/null
if [ $? -ne 0 ]; then
    echo "❌ Agent Worker not running on port 8788. Please run 'pnpm dev' first."
    exit 1
fi
echo "✅ Agent Worker is healthy!"

# Test the /claude-code endpoint
echo "🚀 Testing /claude-code endpoint..."
echo "📡 Sending request to http://localhost:8788/claude-code"
echo ""

# Send a test request to the Claude Code endpoint
curl -X POST http://localhost:8788/claude-code \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "tell me a short joke",
    "model": "openrouter/qwen/qwen3-coder",
    "stream": true,
    "verbose": false
  }' \
  -v

echo ""
echo "🧪 Test completed"