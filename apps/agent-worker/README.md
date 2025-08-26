# Claude Code CLI Proxy

A simple HTTP API wrapper for the Claude Code CLI, enabling web-based access to Claude Code's full capabilities with LiteLLM router integration.

## Overview

This proxy provides a clean HTTP interface to the Claude Code CLI while maintaining the official CLI patterns. It's designed with ultra-simple architecture principles:

- **Minimal Environment Variables**: Only LiteLLM router configuration
- **Direct Parameter Mapping**: HTTP request parameters map directly to Claude Code CLI
- **Official CLI Compliance**: Follows Claude Code CLI documentation exactly
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
    "inputFormat": "text",
    "outputFormat": "json",
    "model": "anthropic/claude-3.5-sonnet-latest",
    "maxTurns": 5,
    "appendSystemPrompt": "You are a Python expert. Write clean, documented code.",
    "verbose": true,
    "allowedTools": ["Write", "Read", "Bash"]
  }'
```

## Architecture

### Session Management Design

```
HTTP Client (with sessionId)
    ↓ POST /claude-code
Cloudflare Worker
    ↓ Parse & validate request
Session-Specific Container (claude-session-{sessionId})
    ↓ Shared workspace (/workspace)
Claude CLI Wrapper (--continue/--resume flags)
    ↓ Direct CLI execution
Claude Code CLI
    ↓ AI model calls
LiteLLM Router → AI Models
```

**Core Session Architecture**:

- **Session ID**: Unique identifier for each user session (UUID)
- **Per Session**: Each sessionId gets its own isolated container instance
- **Per Container**: Container named `claude-session-{sessionId}` for isolation
- **One Workspace**: All operations within a session use shared `/workspace` directory
- **Auto Continue**: CLI wrapper uses working `--continue` and `--resume` flags to maintain context

### Key Principles

1. **Session Isolation**: Each sessionId maps to a dedicated container instance
2. **Workspace Persistence**: Shared `/workspace` directory maintains files across requests
3. **Automatic Continuation**: CLI wrapper maintains session context using proper CLI flags
4. **Environment Variables**: Only for LiteLLM router configuration
5. **HTTP Parameters**: All Claude Code options come from request body
6. **Direct Mapping**: Request parameters → CLI flags (proper flag translation)
7. **Clean Separation**: API config vs request data

## Complete API Reference

### Endpoint: `POST /claude-code`

#### Required Parameters

**Text Format (Default)**:
| Parameter | Type | Description |
| --------- | -------- | ------------------------------------------------------ |
| `prompt` | `string` | **Required.** The query or task to send to Claude Code |

**Stream-JSON Format**:
| Parameter | Type | Description |
| --------- | -------- | ------------------------------------------------------ |
| `messages` | `Array<{role: 'user'\|'assistant', content: Array<{type: 'text', text: string}>}>` | **Required.** Message array for client-side session management |

#### API Configuration

| Parameter      | Type      | Default                      | Description                                                            |
| -------------- | --------- | ---------------------------- | ---------------------------------------------------------------------- |
| `inputFormat`  | `string`  | `"text"`                     | Input format: `"text"` or `"stream-json"`                              |
| `outputFormat` | `string`  | `"json"`                     | Output format: `"text"`, `"json"`, or `"stream-json"`                  |
| `model`        | `string`  | `"groq/openai/gpt-oss-120b"` | AI model (any LiteLLM-compatible model)                                |
| `stream`       | `boolean` | `false`                      | Enable real-time streaming responses (deprecated - use `outputFormat`) |
| `verbose`      | `boolean` | `false`                      | Include detailed logs and full message history                         |

#### Claude Code CLI Parameters

All Claude Code CLI parameters are supported directly. See [Claude Code CLI documentation](https://docs.anthropic.com/en/docs/claude-code/sdk#core-usage) for complete reference.

| Parameter                    | Type                                                          | Default               | Description                                                                   |
| ---------------------------- | ------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------- |
| `maxTurns`                   | `number`                                                      | `3`                   | Maximum conversation turns                                                    |
| `systemPrompt`               | `string`                                                      | `""`                  | Custom system prompt (empty = Claude Code default)                            |
| `appendSystemPrompt`         | `string`                                                      | `undefined`           | Additional context for system prompt                                          |
| `allowedTools`               | `string[]`                                                    | `undefined`           | Specific tools to enable (undefined = all tools)                              |
| `disallowedTools`            | `string[]`                                                    | `undefined`           | Tools to disable                                                              |
| `sessionId`                  | `string`                                                      | `undefined`           | **Session ID for container isolation and auto-continue**                      |
| `continueSession`            | `boolean`                                                     | `false`               | Continue from previous session (auto-enabled with sessionId)                  |
| `resumeSessionId`            | `string`                                                      | `undefined`           | Session ID to resume (legacy - use sessionId instead)                         |
| `permissionMode`             | `"default" \| "acceptEdits" \| "plan" \| "bypassPermissions"` | `"bypassPermissions"` | Permission level                                                              |
| `permissionPromptTool`       | `string`                                                      | `undefined`           | Custom permission tool                                                        |
| `mcpConfig`                  | `object`                                                      | `undefined`           | **MCP server configuration JSON object** (automatically saved as `.mcp.json`) |
| `cwd`                        | `string`                                                      | `undefined`           | Working directory                                                             |
| `executable`                 | `string`                                                      | `undefined`           | Custom executable path                                                        |
| `executableArgs`             | `string[]`                                                    | `undefined`           | Additional executable arguments                                               |
| `pathToClaudeCodeExecutable` | `string`                                                      | `undefined`           | Full path to Claude Code binary                                               |

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

| Environment Variable   | Source                     | Purpose                  |
| ---------------------- | -------------------------- | ------------------------ |
| `ANTHROPIC_MODEL`      | Request `model` or default | Model for LiteLLM router |
| `ANTHROPIC_BASE_URL`   | Worker configuration       | LiteLLM router URL       |
| `ANTHROPIC_AUTH_TOKEN` | Worker configuration       | Authentication mode      |
| `ANTHROPIC_API_KEY`    | Worker configuration       | API key (if provided)    |

### Session-Based Data Flow

1. **HTTP Request**: All Claude Code parameters in request body + sessionId
2. **Container Selection**: Get or create session-specific container `claude-session-{sessionId}`
3. **Workspace Setup**: Ensure shared `/workspace` directory exists in container
4. **Environment Setup**: Only LiteLLM configuration as environment variables
5. **CLI Execution**: Auto-continue with shared workspace and session context

Example session mapping:

```javascript
// HTTP Request with Session
{
  "prompt": "Create a hello.py file",
  "sessionId": "demo-abc123",
  "maxTurns": 10
}

// Container Isolation
containerId = "claude-session-demo-abc123"
workspace = "/workspace"  // Shared across all requests for this session

// Claude Code CLI Call
query({
  prompt: "Create a hello.py file",
  options: {
    sessionId: "demo-abc123",
    continueSession: true,  // Auto-enabled
    cwd: "/workspace",      // Shared workspace
    maxTurns: 10
  }
})
```

## Demo Interface

The proxy includes a demo interface with automatic session management:

- **URL**: `http://localhost:8788/demo/`
- **Auto-Redirect**: Visiting `/demo/` automatically redirects to `/demo/{uuid}`
- **Session Isolation**: Each demo session gets a unique UUID and dedicated container
- **Workspace Persistence**: Files created in a demo session persist across requests
- **Real-time WebSocket**: Live communication with Claude Code

### Demo Session Architecture

```
User visits /demo/
    ↓ Auto-redirect with UUID
/demo/550e8400-e29b-41d4-a716-446655440000
    ↓ WebSocket connection
ClaudeCodeAgent (Durable Object)
    ↓ Container isolation
claud-session-550e8400-e29b-41d4-a716-446655440000
    ↓ Shared workspace
/workspace (persistent across requests)
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
    "allowedTools": ["Read", "Write"],
    "disallowedTools": ["Bash"],
    "permissionMode": "plan"
  }'
```

### Session Continuation

```bash
# First request with sessionId - creates container claude-session-demo-abc123
curl -X POST http://localhost:8788/claude-code \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a hello.py file",
    "sessionId": "demo-abc123"
  }'

# Continue with same sessionId - uses existing container and workspace
curl -X POST http://localhost:8788/claude-code \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Add error handling to hello.py",
    "sessionId": "demo-abc123"
  }'

# Third request - Claude Code automatically sees previous files
curl -X POST http://localhost:8788/claude-code \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What files exist in my workspace?",
    "sessionId": "demo-abc123"
  }'
```

### Streaming Response

```bash
curl -X POST http://localhost:8788/claude-code \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain recursion in programming",
    "outputFormat": "stream-json",
    "verbose": true
  }'
```

### Stream-JSON Input Format (Client-Side Session Management)

```bash
curl -X POST http://localhost:8788/claude-code \
  -H "Content-Type: application/json" \
  -d '{
    "inputFormat": "stream-json",
    "outputFormat": "json",
    "messages": [
      {
        "role": "user",
        "content": [{
          "type": "text",
          "text": "What is the capital of France?"
        }]
      },
      {
        "role": "assistant",
        "content": [{
          "type": "text",
          "text": "The capital of France is Paris."
        }]
      },
      {
        "role": "user",
        "content": [{
          "type": "text",
          "text": "What about Italy?"
        }]
      }
    ],
    "maxTurns": 5
  }'
```

### MCP Server Configuration

```bash
curl -X POST http://localhost:8788/claude-code \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "List files in the current directory",
    "mcpConfig": {
      "servers": {
        "filesystem": {
          "command": "node",
          "args": ["/path/to/filesystem-server.js"],
          "env": {
            "ROOT_PATH": "/workspace"
          }
        },
        "database": {
          "command": "python",
          "args": ["-m", "database_mcp_server"],
          "env": {
            "DB_URL": "sqlite:///workspace/data.db"
          }
        }
      }
    }
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

## Known Issues

### Session Continuity Fixed ✅

**Status**: ✅ **Resolved** - Session continuity now working with CLI wrapper approach

**Solution**: Replaced broken TypeScript SDK with direct CLI execution using working `--continue` and `--resume` flags.

**New Architecture**:

- **CLI Wrapper**: Direct Claude CLI execution bypassing broken SDK
- **Session Mapping**: HTTP sessionId → Claude CLI session ID mapping
- **Flag Support**: Working `--continue` and `--resume` flags
- **File Creation**: Automatic `.mcp.json` file creation for MCP configuration

**Previous Issues** (now resolved):

- TypeScript SDK ignoring session continuation parameters
- Session files not being properly detected in containerized environment
- `continueSession` and `resumeSessionId` parameters having no effect

**Current Status**: Session continuity working via CLI wrapper with proper `--continue` and `--resume` flag support.

## Troubleshooting

### Container Logs

```bash
# Find session-specific container
docker ps --filter "name=claude-session-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# View logs for specific session
docker logs claude-session-demo-abc123

# Follow logs in real-time for debugging
docker logs -f claude-session-demo-abc123

# Check workspace contents
docker exec claude-session-demo-abc123 ls -la /workspace

# Interactive session for debugging
docker exec -it claude-session-demo-abc123 /bin/bash

# Check session files in container
docker exec claude-session-demo-abc123 ls -la /root/.claude/projects/-workspace/
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

#### Session Continuity Issues

**Symptoms**: Files created in previous requests are not visible, Claude Code asks about existing files

**Debug Steps**:

1. Verify sessionId is being passed consistently: `"sessionId": "demo-abc123"`
2. Check container exists: `docker ps --filter "name=claude-session-demo-abc123"`
3. Verify workspace contents: `docker exec claude-session-demo-abc123 ls -la /workspace`
4. Ensure continueSession is enabled (auto-enabled with sessionId)

#### Parameter Not Working

**Symptoms**: Claude Code ignores parameter

**Debug Steps**:

1. Check parameter name matches Claude Code SDK documentation
2. Verify parameter type (string vs number vs boolean)
3. Enable verbose logging: `"verbose": true`
4. For sessionId: Ensure it's a valid string and container isolation is working

### Debug Logs

The proxy provides detailed logging:

```
🤖 ULTRA-SIMPLE: Direct request-to-SDK mapping
🤖 Prompt (from request): What is 2+2?
🤖 Model (env fallback): groq/openai/gpt-oss-120b
🤖 LiteLLM Base URL: https://litellm-router.memorysaver.workers.dev
```

Enable verbose mode for complete Claude Code CLI logs:

```json
{ "verbose": true }
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

- **Session Isolation**: Each sessionId gets dedicated container for true isolation
- **Workspace Persistence**: Shared `/workspace` maintains file state across requests
- **Automatic Continuation**: `continueSession: true` enables seamless context preservation
- **Scalability**: Container-per-session allows unlimited concurrent sessions
- **Simplicity**: Minimal environment variables, direct parameter mapping
- **Compliance**: Follows official Claude Code CLI patterns exactly
- **Flexibility**: All Claude Code CLI features available via HTTP
- **Maintainability**: Clean separation between API config and request data
- **Debuggability**: Session-specific containers enable precise debugging
