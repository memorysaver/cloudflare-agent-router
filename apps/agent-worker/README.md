# Agent Worker

A Cloudflare Workers application that provides Claude Code SDK integration via containerized execution.

## Overview

The Agent Worker implements a multi-layered architecture that enables Claude Code execution within Cloudflare's serverless environment using containers. It provides a REST API endpoint for executing Claude Code queries with full session isolation and streaming support.

## Architecture

### System Design

```
Client Request
     ↓
Cloudflare Worker (Hono Router)
     ↓
Claude Code Handler
     ↓
ClaudeCodeContainer (Cloudflare Container)
     ↓
Node.js HTTP Server (claude-server.js)
     ↓
Claude Code SDK
     ↓
LiteLLM Router → AI Models
```

### Core Components

#### 1. **Main Worker** (`src/index.ts`)
- Hono-based HTTP router
- Handles `/claude-code` POST endpoint
- Request validation and routing

#### 2. **Claude Code Handler** (`src/handlers/claude-code.ts`)
- Parses HTTP requests into `ClaudeCodeOptions`
- Manages container lifecycle
- Environment variable configuration
- Request forwarding to container

#### 3. **ClaudeCodeContainer** (`src/claude-container.ts`)
- Extends Cloudflare Container class
- Manages containerized Claude Code execution
- HTTP request forwarding to internal server
- Session isolation and cleanup

#### 4. **Container HTTP Server** (`claude-server.js`)
- Node.js + Hono server running inside Docker container
- Claude Code SDK integration
- Request parsing and session management
- Response streaming and logging

#### 5. **Docker Container** (`claude.Dockerfile`)
- Node.js 20-slim base image
- Claude Code SDK installation
- Container runtime configuration

### Request Flow

#### 1. **Client Request**
```json
POST /claude-code
{
  "prompt": "What is 7 * 6?",
  "model": "openrouter/qwen/qwen3-coder",
  "stream": false,
  "maxTurns": 3
}
```

#### 2. **Handler Processing**
- Validates request body
- Creates `ClaudeCodeOptions` object
- Configures environment variables
- Gets container instance by name

#### 3. **Container Execution**
- Sets environment variables for fallback configuration
- Creates HTTP request with actual data in body
- Forwards to container's internal HTTP server
- Returns streaming or non-streaming response

#### 4. **SDK Integration**
- Parses HTTP request body (primary) + env vars (fallback)
- Generates unique request ID for logging
- Creates fresh AbortController for isolation
- Executes Claude Code SDK query with session management

#### 5. **Response Generation**
- Streams messages from Claude Code SDK
- Logs session IDs and results for debugging
- Returns JSON response with result and session metadata

## Session Management

### Isolation Strategy
- **Request Isolation**: Each HTTP request gets fresh Claude Code SDK query
- **Session Isolation**: New session ID generated per request
- **Process Isolation**: AbortController per request for cancellation
- **Container Isolation**: Persistent container with fresh SDK processes

### Configuration
```typescript
interface ClaudeCodeOptions {
  prompt: string           // User query
  model?: string          // AI model (default: claude-3-5-sonnet-20241022)
  stream?: boolean        // Streaming response (default: true)
  verbose?: boolean       // Detailed logging (default: false)
  maxTurns?: number      // Conversation turns (default: 3)
  additionalArgs?: string[] // Extra CLI arguments
}
```

### Environment Variables
```bash
# Primary Configuration
ANTHROPIC_BASE_URL=https://litellm-router.memorysaver.workers.dev
ANTHROPIC_AUTH_TOKEN=auto-detect

# Container Runtime (set dynamically)
CLAUDE_PROMPT=<request_prompt>
ANTHROPIC_MODEL=<request_model>
CLAUDE_STREAM=true|false
CLAUDE_VERBOSE=true|false
CLAUDE_MAX_TURNS=3
```

## API Reference

### POST /claude-code

Execute Claude Code with specified prompt and configuration.

#### Request Body
```typescript
{
  prompt: string           // Required: The query to execute
  model?: string          // Optional: AI model to use
  stream?: boolean        // Optional: Enable streaming (default: true)
  verbose?: boolean       // Optional: Verbose logging (default: false)
  maxTurns?: number      // Optional: Max conversation turns (default: 3)
  additionalArgs?: string[] // Optional: Additional CLI arguments
}
```

#### Response Format
```typescript
// Non-streaming response
{
  type: "result"
  result: string          // The Claude Code output
  sessionId: string       // Unique session identifier
  messages?: array        // Full message history (if verbose)
}

// Streaming response (Content-Type: text/plain)
{"type":"assistant","content":"..."}
{"type":"tool_call","tool":"...","input":"..."}
{"type":"tool_result","tool":"...","result":"..."}
{"type":"result","result":"Final answer"}
```

#### Error Response
```typescript
{
  type: "error"
  error: string          // Error type
  message: string        // Human-readable message
  details?: string       // Stack trace or additional info
}
```

## Development

### Local Development

#### Prerequisites
- Node.js 20+
- pnpm
- Docker
- Cloudflare CLI (wrangler)

#### Setup
```bash
# Install dependencies
pnpm install

# Run in dev mode (includes container building)
pnpm turbo dev

# Access at http://localhost:8788
```

#### Development Commands
```bash
# Development server with hot reload
pnpm turbo dev

# Build for production
pnpm turbo build

# Run tests
pnpm test

# Type checking
pnpm turbo check:types

# Linting
pnpm turbo check:lint

# Deploy to Cloudflare
pnpm turbo deploy
```

### Container Development

#### Manual Container Testing
```bash
# Build container image
docker build -f claude.Dockerfile -t claude-code-test .

# Run container locally
docker run -p 3000:3000 -e ANTHROPIC_BASE_URL="https://litellm-router.memorysaver.workers.dev" claude-code-test

# Test container endpoint
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is 2+2?", "model": "openrouter/qwen/qwen3-coder"}'
```

#### Container Debugging
```bash
# Get running container ID
docker ps --filter "ancestor=cloudflare-dev/claudecodecontainer"

# View container logs
docker logs <container_id>

# Execute commands in container
docker exec -it <container_id> /bin/bash
```

### Testing

#### Integration Tests
```bash
# Run all tests
pnpm test

# Run specific test file
pnpm vitest src/test/integration/api.test.ts

# Run with coverage
pnpm vitest --coverage
```

#### Manual Testing Script
```bash
# Use the test script
./test-claude-code.sh
```

## Configuration

### Container Configuration
- **Port**: 3000 (internal)
- **Timeout**: 10 minutes (`sleepAfter`)
- **Internet**: Enabled for API calls
- **Lifecycle**: Persistent with automatic cleanup

### Model Configuration
- **Default Model**: `claude-3-5-sonnet-20241022`
- **Router**: LiteLLM proxy at `litellm-router.memorysaver.workers.dev`
- **Authentication**: Auto-detect mode
- **Supported Models**: All models available through LiteLLM router

### Performance Configuration
- **Max Turns**: 3 (configurable per request)
- **Streaming**: Enabled by default
- **Session Isolation**: Fresh sessions per request
- **Container Reuse**: Optimized for multiple requests

## Troubleshooting

### Common Issues

#### Container Not Starting
- Check Docker daemon is running
- Verify port 3000 is available
- Check container build logs for errors

#### Empty Responses
- Verify `ANTHROPIC_BASE_URL` configuration
- Check LiteLLM router accessibility
- Review container logs for SDK errors

#### Session Caching
- Ensure request body is properly formatted
- Verify different prompts in container logs
- Check session IDs are unique per request

### Debug Endpoints

#### Container Health Check
```bash
# Check container status (when running)
curl http://localhost:3000/

# Debug container environment
curl http://localhost:3000/debug
```

#### Logging
- **Container Logs**: `docker logs <container_id>`
- **Worker Logs**: Cloudflare Workers dashboard
- **Request Tracing**: Unique request IDs in logs

## Deployment

### Production Deployment
```bash
# Build and deploy
pnpm turbo deploy

# Deploy specific environment
wrangler deploy --env production
```

### Environment Configuration
- Set `ANTHROPIC_BASE_URL` in production wrangler.jsonc
- Configure container limits and timeouts
- Set up monitoring and alerting

## Architecture Benefits

### Scalability
- **Container Isolation**: Multiple concurrent executions
- **Stateless Design**: Horizontal scaling friendly
- **Session Management**: No shared state between requests

### Reliability
- **Error Recovery**: Container restart capability
- **Request Isolation**: Failed requests don't affect others
- **Fallback Configuration**: Environment variables as backup

### Performance
- **Container Reuse**: Persistent containers reduce startup time
- **Streaming**: Real-time response delivery
- **Parallel Processing**: Multiple containers for concurrent requests

### Security
- **Sandboxed Execution**: Containers provide isolation
- **No Shared State**: Each request isolated
- **Environment Separation**: Runtime configuration isolation
