# Claude Code SDK Proxy

A simple HTTP API wrapper for the Claude Code SDK, enabling web-based access to Claude Code's full capabilities with LiteLLM router integration.

## Overview

This proxy provides a clean HTTP interface to the Claude Code SDK while maintaining the official SDK patterns. It's designed with ultra-simple architecture principles:

- **Minimal Environment Variables**: Only LiteLLM router configuration
- **Direct Parameter Mapping**: HTTP request parameters map directly to Claude Code SDK
- **Official SDK Compliance**: Follows Claude Code SDK documentation exactly
- **Container Isolation**: Each request runs in isolated Docker containers
- **Session Management**: Automatic fresh sessions with proper cleanup

## Quick Start

### Basic Usage

```bash
curl -X POST http://localhost:8788/claude-code \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is 2+2?"}'
```

Response:
```json
{
  "type": "result",
  "result": "4", 
  "sessionId": "abc123...",
  "requestId": "req_...",
  "cost_usd": 0.000444,
  "duration_ms": 5100
}
```

### Advanced Example

```bash
curl -X POST http://localhost:8788/claude-code \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a Python function to calculate fibonacci numbers",
    "model": "anthropic/claude-3.5-sonnet-latest",
    "stream": false,
    "maxTurns": 5,
    "systemPrompt": "You are a Python expert. Write clean, documented code.",
    "verbose": true
  }'
```

## Architecture

### Ultra-Simple Design

```
HTTP Client
    ↓ POST /claude-code
Cloudflare Worker
    ↓ Parse & validate request
Docker Container
    ↓ Direct parameter mapping
Claude Code SDK
    ↓ AI model calls
LiteLLM Router → AI Models
```

### Key Principles

1. **Environment Variables**: Only for LiteLLM router configuration
2. **HTTP Parameters**: All Claude Code options come from request body
3. **Direct Mapping**: Request parameters → SDK parameters (no transformation)
4. **Clean Separation**: API config vs request data

## Complete API Reference

### Endpoint: `POST /claude-code`

#### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | `string` | **Required.** The query or task to send to Claude Code |

#### API Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | `string` | `"groq/openai/gpt-oss-120b"` | AI model (any LiteLLM-compatible model) |
| `stream` | `boolean` | `false` | Enable real-time streaming responses |
| `verbose` | `boolean` | `false` | Include detailed logs and full message history |

#### Claude Code SDK Parameters

All Claude Code SDK parameters are supported directly. See [Claude Code SDK documentation](https://docs.anthropic.com/en/docs/claude-code/sdk#type-script) for complete reference.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `maxTurns` | `number` | `3` | Maximum conversation turns |
| `systemPrompt` | `string` | `""` | Custom system prompt (empty = Claude Code default) |
| `appendSystemPrompt` | `string` | `undefined` | Additional context for system prompt |
| `allowedTools` | `string[]` | `undefined` | Specific tools to enable (undefined = all tools) |
| `disallowedTools` | `string[]` | `undefined` | Tools to disable |
| `continueSession` | `boolean` | `false` | Continue from previous session |
| `resumeSessionId` | `string` | `undefined` | Session ID to resume |
| `permissionMode` | `"default" \| "acceptEdits" \| "plan" \| "bypassPermissions"` | `"default"` | Permission level |
| `permissionPromptTool` | `string` | `undefined` | Custom permission tool |
| `mcpConfig` | `string` | `undefined` | MCP server configuration |
| `cwd` | `string` | `undefined` | Working directory |
| `executable` | `string` | `undefined` | Custom executable path |
| `executableArgs` | `string[]` | `undefined` | Additional executable arguments |
| `pathToClaudeCodeExecutable` | `string` | `undefined` | Full path to Claude Code binary |

### Response Formats

#### Non-Streaming Response

```typescript
{
  type: "result"
  result: string          // Claude Code output
  sessionId: string       // Unique session identifier  
  requestId: string       // Unique request identifier
  cost_usd?: number      // Execution cost (if available)
  duration_ms?: number   // Execution time in milliseconds
  messages?: array       // Full message history (if verbose: true)
}
```

#### Streaming Response

Content-Type: `text/plain`

```json
{"type":"assistant","content":"I'll help you with that..."}
{"type":"tool_call","tool":"write_file","input":{"path":"script.py","content":"..."}}
{"type":"tool_result","tool":"write_file","result":"File written successfully"}
{"type":"result","result":"I've created the Python script for you."}
```

#### Error Response

```typescript
{
  type: "error"
  error: string          // Error category
  message: string        // Human-readable error message
  details?: string       // Additional debugging info
}
```

## Environment Configuration

The proxy uses minimal environment variables for LiteLLM router configuration only.

### Container Environment Variables

Only these environment variables are injected into the container:

| Environment Variable | Source | Purpose |
|---------------------|--------|---------|
| `ANTHROPIC_MODEL` | Request `model` or default | Model for LiteLLM router |
| `ANTHROPIC_BASE_URL` | Worker configuration | LiteLLM router URL |
| `ANTHROPIC_AUTH_TOKEN` | Worker configuration | Authentication mode |
| `ANTHROPIC_API_KEY` | Worker configuration | API key (if provided) |

### Data Flow

1. **HTTP Request**: All Claude Code parameters in request body
2. **Environment Setup**: Only LiteLLM configuration as environment variables
3. **Direct Mapping**: Request parameters → Claude Code SDK options
4. **SDK Execution**: Following official Claude Code SDK patterns

Example mapping:
```javascript
// HTTP Request
{
  "prompt": "What is 2+2?",
  "maxTurns": 3,
  "systemPrompt": "You are helpful"
}

// Claude Code SDK Call
query({
  prompt: "What is 2+2?",
  options: {
    maxTurns: 3,
    systemPrompt: "You are helpful"
  }
})
```

## Usage Examples

### Basic Math Query

```bash
curl -X POST http://localhost:8788/claude-code \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Calculate 15 * 23"}'
```

### Code Generation

```bash
curl -X POST http://localhost:8788/claude-code \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a React component for a todo list",
    "model": "anthropic/claude-3.5-sonnet-latest",
    "systemPrompt": "You are a React expert. Use TypeScript.",
    "maxTurns": 5
  }'
```

### Tool Restrictions

```bash
curl -X POST http://localhost:8788/claude-code \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Help me analyze data",
    "allowedTools": ["read_file", "write_file"],
    "permissionMode": "plan"
  }'
```

### Session Continuation

```bash
# First request
curl -X POST http://localhost:8788/claude-code \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Start a Python script"}'

# Continue with returned sessionId
curl -X POST http://localhost:8788/claude-code \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Add error handling",
    "continueSession": true,
    "resumeSessionId": "abc123..."
  }'
```

### Streaming Response

```bash
curl -X POST http://localhost:8788/claude-code \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain recursion in programming",
    "stream": true,
    "verbose": true
  }'
```

## Development

### Prerequisites

- Node.js 20+
- pnpm
- Docker
- Cloudflare CLI (wrangler)

### Local Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm turbo dev

# Access at http://localhost:8788/claude-code
```

### Testing

```bash
# Quick test
curl -X POST http://localhost:8788/claude-code \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello Claude!"}'

# Run test suite
pnpm test

# Type checking
pnpm turbo check:types
```

## Troubleshooting

### Container Logs

```bash
# Find running container
docker ps --filter "ancestor=cloudflare-dev/claudecodecontainer"

# View logs
docker logs <container_id>

# Follow logs in real-time
docker logs -f <container_id>
```

### Common Issues

#### Request Timeouts

**Symptoms**: HTTP request hangs or times out

**Debug Steps**:
1. Check container logs for errors
2. Verify model exists: `curl https://litellm-router.memorysaver.workers.dev/v1/models`
3. Test with known working model: `"groq/openai/gpt-oss-120b"`

#### Invalid Model Errors

**Symptoms**: Error responses about model not found

**Solutions**:
1. Check available models: `curl https://litellm-router.memorysaver.workers.dev/v1/models`
2. Use full model name (e.g., `"groq/openai/gpt-oss-120b"` not `"gpt-oss-120b"`)
3. Verify LiteLLM router is accessible

#### Parameter Not Working

**Symptoms**: Claude Code ignores parameter

**Debug Steps**:
1. Check parameter name matches Claude Code SDK documentation
2. Verify parameter type (string vs number vs boolean)
3. Enable verbose logging: `"verbose": true`

### Debug Logs

The proxy provides detailed logging:

```
🤖 ULTRA-SIMPLE: Direct request-to-SDK mapping
🤖 Prompt (from request): What is 2+2?
🤖 Model (env fallback): groq/openai/gpt-oss-120b
🤖 LiteLLM Base URL: https://litellm-router.memorysaver.workers.dev
```

Enable verbose mode for complete Claude Code SDK logs:
```json
{"verbose": true}
```

## Deployment

### Production Deployment

```bash
# Deploy to Cloudflare
pnpm turbo deploy

# Check status
wrangler deployments list
```

### Environment Configuration

Set in `wrangler.jsonc`:

```json
{
  "vars": {
    "ANTHROPIC_BASE_URL": "https://litellm-router.memorysaver.workers.dev",
    "ANTHROPIC_AUTH_TOKEN": "auto-detect"
  }
}
```

## Architecture Benefits

- **Simplicity**: Minimal environment variables, direct parameter mapping
- **Compliance**: Follows official Claude Code SDK patterns exactly
- **Flexibility**: All Claude Code SDK features available via HTTP
- **Scalability**: Container isolation allows concurrent requests
- **Maintainability**: Clean separation between API config and request data
- **Debuggability**: Clear logging and request tracing