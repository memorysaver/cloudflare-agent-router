#!/bin/bash

# Claude Code Wrapper Script
# This script reads environment variables and executes the Claude Code CLI
# with the appropriate parameters for streaming output

set -e

echo "🤖 Starting Claude Code execution..."
echo "🤖 Model: ${ANTHROPIC_MODEL:-openrouter/qwen/qwen3-coder}"
echo "🤖 Base URL: ${ANTHROPIC_BASE_URL:-https://litellm-router.memorysaver.workers.dev}"
echo "🤖 Auth Token: ${ANTHROPIC_AUTH_TOKEN:-auto-detect}"
echo "🤖 Stream: ${CLAUDE_STREAM:-true}"
echo "🤖 Verbose: ${CLAUDE_VERBOSE:-false}"

# Build the Claude Code command
CLAUDE_CMD="claude -p \"${CLAUDE_PROMPT}\""

# Add output format for streaming
if [ "${CLAUDE_STREAM}" = "true" ]; then
    CLAUDE_CMD="${CLAUDE_CMD} --output-format stream-json"
fi

# Add verbose flag if requested
if [ "${CLAUDE_VERBOSE}" = "true" ]; then
    CLAUDE_CMD="${CLAUDE_CMD} --verbose"
fi

# Add model (use default if not specified)
CLAUDE_CMD="${CLAUDE_CMD} --model ${ANTHROPIC_MODEL:-openrouter/qwen/qwen3-coder}"

# Add any additional arguments
if [ -n "${CLAUDE_ADDITIONAL_ARGS}" ]; then
    CLAUDE_CMD="${CLAUDE_CMD} ${CLAUDE_ADDITIONAL_ARGS}"
fi

echo "🤖 Executing: ${CLAUDE_CMD}"

# Execute the Claude Code command
# The output will be streamed back through the container
eval "${CLAUDE_CMD}"

echo "🤖 Claude Code execution completed"