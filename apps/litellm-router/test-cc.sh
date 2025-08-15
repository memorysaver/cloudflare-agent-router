#!/bin/bash
# Simple Claude Code + Local Router Test Script
# Tests Claude Code integration with our simplified LiteLLM router

echo "🔍 Checking router health on port 8787..."
curl -s http://localhost:8787/worker-health > /dev/null
if [ $? -ne 0 ]; then
    echo "❌ Router not running on port 8787. Please run 'just dev' first."
    exit 1
fi
echo "✅ Router is healthy!"

# Set environment variables to point Claude Code to our local router
export ANTHROPIC_AUTH_TOKEN="auto-detect"
export ANTHROPIC_BASE_URL="http://localhost:8787"
export ANTHROPIC_MODEL="openrouter/qwen/qwen3-coder"
export ANTHROPIC_SMALL_FAST_MODEL="openrouter/qwen/qwen3-coder"

echo "🚀 Launching Claude Code with local router..."
echo "📡 Using model: $ANTHROPIC_MODEL"
echo "🌐 Router URL: $ANTHROPIC_BASE_URL"
echo ""

# Fire Claude Code command
claude -p "tell me a joke" --output-format stream-json --verbose