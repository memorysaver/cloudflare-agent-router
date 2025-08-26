# Agent Management System Documentation

## Overview

This document provides comprehensive technical documentation for the Cloudflare Agent Router's agent management system, specifically focusing on the Claude Code Agent integration with Cloudflare Workers, Durable Objects, Containers, and the LiteLLM proxy architecture.

## System Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│   Demo UI       │    │   Agent Worker   │    │ ClaudeCodeAgent │    │ClaudeCodeContainer│
│  (WebSocket)    │◄──►│   (Hono Router)  │◄──►│ (Durable Object)│◄──►│ (Durable Object) │
│                 │    │                  │    │                 │    │                  │
│ - Model Select  │    │ - WebSocket      │    │ - Session State │    │ - Container      │
│ - Real-time UI  │    │ - REST API       │    │ - Message Queue │    │ - claude-server  │
│ - Session Mgmt  │    │ - Request Route  │    │ - Agent Bridge  │    │ - Claude Code SDK│
└─────────────────┘    └──────────────────┘    └─────────────────┘    └──────────────────┘
                                 │
                                 ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │  LiteLLM Router  │◄──►│  Model Providers│
                       │   (Separate      │    │ - OpenRouter    │
                       │    Worker)       │    │ - Groq          │
                       │                  │    │ - Anthropic     │
                       └──────────────────┘    └─────────────────┘
```

## Complete Call Stack Analysis

### 1. User Request Initiation

**WebSocket Flow (Primary)**:

```typescript
// 1. User action in Demo UI (JavaScript)
ws.send(
  JSON.stringify({
    type: 'user_message',
    content: 'Create a hello world app',
    model: 'groq/openai/gpt-oss-120b',
    timestamp: Date.now(),
  })
)

// 2. WebSocket Handler (src/handlers/claude-agent.ts:29)
onMessage: async (event, ws: WSContext) => {
  const message = JSON.parse(event.data as string) as WSMessage

  // 3. Get session-specific agent instance
  const agentId = c.env.CLAUDE_CODE_AGENT.idFromName(`session-${sessionId}`)
  const agent = c.env.CLAUDE_CODE_AGENT.get(agentId)

  // 4. Process through agent
  await agent.processMessage(message.content, sessionId, message.model)
}
```

### 2. Agent Processing Layer

**ClaudeCodeAgent Processing (src/agents/claude-code-agent.ts:172)**:

```typescript
async processMessage(content: string, sessionId?: string, model?: string): Promise<void> {
    // 1. Store model preference in agent state
    if (model) {
        this.setState({
            ...this.typedState,
            claudeSession: {
                ...this.typedState.claudeSession,
                preferredModel: model
            }
        });
    }

    // 2. Add user message to conversation history
    const userMessage: AgentMessage = {
        id: this.generateId(),
        role: 'user',
        content: content,
        type: 'result',
        timestamp: Date.now()
    };
    this.addMessageToState(userMessage);

    // 3. Execute via container bridge
    const executionStream = await this.containerBridge.execute(content, {
        sessionId: this.getSessionId(),
        model: this.getCurrentModel()
    });

    // 4. Process streaming response
    await this.processClaudeStream(executionStream);
}
```

### 3. Container Bridge Layer

**ClaudeContainerBridge Execution (src/agents/claude-code-agent.ts:355)**:

```typescript
async execute(prompt: string, options: {
    sessionId: string,
    model?: string
}): Promise<ReadableStream> {
    // 1. Prepare Claude Code execution options
    const claudeOptions: ClaudeCodeOptions = {
        prompt,
        model: options.model || 'groq/openai/gpt-oss-120b',
        sessionId: options.sessionId, // Pass sessionId to Claude Code SDK
        continueSession: true,        // Always try to continue
        cwd: '/workspace',           // Shared workspace
        stream: true,
        verbose: false,
        maxTurns: 10,
        permissionMode: 'acceptEdits',
        systemPrompt: '',            // Empty - let Claude Code use default
    };

    // 2. Get session-specific container instance
    const containerId = `claude-session-${options.sessionId}`;
    const id = this.env.CLAUDE_CONTAINER.idFromName(containerId);
    const container = this.env.CLAUDE_CONTAINER.get(id);

    // 3. Execute and return stream
    const response = await container.executeClaudeCode(claudeOptions, envVars);
    return response.body!;
}
```

### 4. Container Runtime Layer

**ClaudeCodeContainer Execution (src/claude-container.ts:85)**:

```typescript
async executeClaudeCode(
    options: ClaudeCodeOptions,
    envVars: Record<string, string>
): Promise<Response> {
    // 1. Configure environment variables for LiteLLM
    this.envVars = {
        ...envVars,
        ANTHROPIC_MODEL: options.model || 'groq/openai/gpt-oss-120b',
        ANTHROPIC_BASE_URL: this.env.ANTHROPIC_BASE_URL || 'https://litellm-router.memorysaver.workers.dev',
        ANTHROPIC_AUTH_TOKEN: this.env.ANTHROPIC_AUTH_TOKEN || 'auto-detect',
    };

    // 2. Start container if needed
    await this.start();

    // 3. Forward request to claude-server.js
    const request = new Request(`http://localhost:${this.defaultPort}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
    });

    // 4. Execute via containerFetch
    return await this.containerFetch(request);
}
```

### 5. Claude SDK Wrapper Layer

**claude-server.js Processing (claude-server.js:113)**:

```javascript
app.post('/', async (c) => {
  // 1. Parse request from container bridge
  const requestBody = await c.req.json()
  const model = requestBody.model || process.env.ANTHROPIC_MODEL || 'groq/openai/gpt-oss-120b'

  // 2. Simplified session management - shared workspace
  let sessionWorkspacePath = cwd || '/workspace'
  console.log(`📁 Using shared workspace: ${sessionWorkspacePath}`)

  // Ensure shared workspace directory exists
  fs.mkdirSync(sessionWorkspacePath, { recursive: true })

  // 3. Configure Claude Code SDK options
  const options = {
    systemPrompt: systemPrompt || '', // Empty - let Claude Code use default
    maxTurns: maxTurns,
    allowedTools: allowedTools || undefined,
    permissionMode: permissionMode || 'acceptEdits',
    cwd: sessionWorkspacePath,
    ...(sessionId && { sessionId: sessionId }),
    continueSession: continueSession !== false, // Default to true unless explicitly false
  }

  // 4. Execute Claude Code SDK with streaming
  for await (const message of query({ prompt, abortController, options })) {
    // Stream responses back through container to agent to WebSocket
    controller.enqueue(new TextEncoder().encode(JSON.stringify(message) + '\n'))
  }
})
```

### 6. Model Routing Layer

**LiteLLM Router Integration**:

```yaml
# litellm_config.yaml - Model routing configuration
model_list:
  - model_name: openrouter/*
    litellm_params:
      model: openrouter/*
      api_base: https://openrouter.ai/api/v1

  - model_name: groq/*
    litellm_params:
      model: groq/*
      api_base: https://api.groq.com/openai/v1

router_settings:
  routing_strategy: 'least-busy'
  enable_loadbalancing: true
  retry_policy:
    max_retries: 3
    timeout: 30
    exponential_backoff: true
```

## Session Management Strategy

### Simplified Session Architecture

The system implements a streamlined session management strategy:

**Core Concept**: Session ID → Container Isolation → Shared Workspace → Auto-Continue

#### Agent Framework State (Durable Object)

**Storage**: Cloudflare Durable Object persistent storage
**Scope**: WebSocket connections, conversation history, user preferences
**Location**: `ClaudeCodeAgent` class

```typescript
interface AgentSessionState {
  // Agent framework standard state
  messages: AgentMessage[]
  isRunning: boolean
  lastActivity: number

  // Claude Code specific state
  claudeSession: {
    id: string
    workspacePath: string // Always '/workspace'
    lastCommand: string
    sessionFiles: string[]
    activeTools: string[]
    preferredModel?: string // Model selection persistence
  }

  // Container management
  containerState: {
    isActive: boolean
    lastHeartbeat: number
  }
}
```

**State Management Methods**:

```typescript
// Get current model with fallback
private getCurrentModel(): string {
    return this.typedState.claudeSession?.preferredModel || 'groq/openai/gpt-oss-120b';
}

// Type-safe state access
get typedState(): AgentSessionState {
    return this.state as AgentSessionState;
}

// Session workspace path - shared workspace within container
private getWorkspacePath(): string {
    return '/workspace';
}
```

#### Container Isolation Architecture

**Storage**: Container-level isolation with shared workspace
**Scope**: Code files, workspace state, execution context
**Location**: Session-specific containers

**Container Architecture**:

```
Session: demo-abc123
↓
Container: claude-session-demo-abc123
↓
Workspace: /workspace (shared across all requests)
├── src/
├── package.json
└── ... (user files)
```

**Simplified Session Lifecycle**:

```typescript
// 1. Session request with sessionId
const sessionId = 'demo-abc123'

// 2. Get or create session-specific container
const containerId = `claude-session-${sessionId}`
const container = env.CLAUDE_CONTAINER.get(env.CLAUDE_CONTAINER.idFromName(containerId))

// 3. Execute with shared workspace and auto-continue
const claudeOptions = {
  sessionId: sessionId,
  continueSession: true, // Always enabled for sessions
  cwd: '/workspace', // Shared workspace
}

// No renaming or temp folders needed - container persists for entire session
```

### State Synchronization Flow

```
User Action (Model Change)
    ↓
Demo UI → localStorage.setItem(`model_${sessionId}`, newModel)
    ↓
WebSocket Message → { type: 'user_message', model: newModel }
    ↓
Agent State Update → claudeSession.preferredModel = newModel
    ↓
Container Execution → uses stored model preference
    ↓
Real-time UI Update → model persisted across reconnections
```

## API Interface Specifications

### WebSocket API

**Endpoint**: `wss://{worker-domain}/demo/ws/{sessionId}`

**Connection Flow**:

```javascript
// 1. Client connection
const ws = new WebSocket(`wss://agent-worker.example.com/demo/ws/session123`);

// 2. Message protocol
interface WSMessage {
    type: 'user_message' | 'agent_response' | 'error' | 'status';
    content?: string;
    model?: string;          // Model selection parameter
    data?: unknown;
    timestamp?: number;
}
```

**Supported Message Types**:

#### Inbound (Client → Server)

```typescript
// User message with model selection
{
    type: 'user_message',
    content: 'Create a React component',
    model: 'groq/openai/gpt-oss-120b',
    timestamp: 1703123456789
}
```

#### Outbound (Server → Client)

```typescript
// Assistant response
{
    type: 'result',
    content: 'I\'ll help you create a React component...',
    timestamp: 1703123456790
}

// Tool usage notification
{
    type: 'tool_use',
    content: 'Creating file: src/MyComponent.jsx',
    timestamp: 1703123456791
}

// File change notification
{
    type: 'file_change',
    content: 'Modified: src/App.js',
    timestamp: 1703123456792
}

// Error response
{
    type: 'error',
    content: 'Failed to compile: Missing dependency',
    timestamp: 1703123456793
}
```

### REST API

#### Agent Message Endpoint

**Endpoint**: `POST /agent/message`
**Purpose**: HTTP fallback for non-WebSocket clients

```typescript
// Request format
{
    "message": "Create a hello world app"
}

// Response format
{
    "status": "Message processed",
    "timestamp": 1703123456789
}
```

#### Legacy Claude Code Endpoint

**Endpoint**: `POST /claude-code`
**Purpose**: Direct container access (bypasses agent framework)

```typescript
// Request format (ClaudeCodeOptions)
{
    "prompt": "Create a hello world app",
    "model": "groq/openai/gpt-oss-120b",
    "stream": true,
    "verbose": false,
    "maxTurns": 10,
    "permissionMode": "acceptEdits",
    "sessionId": "session_1234567890"
}

// Response format (streaming or JSON)
{
    "type": "result",
    "result": "I'll help you create a hello world app...",
    "sessionId": "session_1234567890",
    "requestId": "req_1703123456789_abc123"
}
```

## LiteLLM Proxy Integration

### Architecture Overview

```
Claude Code SDK → LiteLLM Router Worker → Model Provider APIs
                      ↓
                 Model Routing Logic
                 Authentication
                 Load Balancing
                 Retry Policies
```

### Model Selection Flow

**1. Model Configuration (wrangler.jsonc)**:

```json
{
  "vars": {
    "ANTHROPIC_BASE_URL": "https://litellm-router.memorysaver.workers.dev"
  }
}
```

**2. Request Flow**:

```typescript
// Agent passes model preference to container
const claudeOptions: ClaudeCodeOptions = {
  model: options.model || 'groq/openai/gpt-oss-120b',
  // ... other options
}

// Container configures environment for Claude Code SDK
this.envVars = {
  ANTHROPIC_MODEL: options.model,
  ANTHROPIC_BASE_URL: 'https://litellm-router.memorysaver.workers.dev',
  ANTHROPIC_AUTH_TOKEN: 'auto-detect',
}

// Claude Code SDK makes request to LiteLLM router
// Router routes based on model prefix: groq/*, openrouter/*, anthropic/*
```

**3. Model Routing Rules**:

```yaml
# LiteLLM routes requests based on model name patterns
groq/openai/gpt-oss-120b    → api.groq.com/openai/v1
openrouter/z-ai/glm-4.5     → openrouter.ai/api/v1
anthropic/claude-3-sonnet   → api.anthropic.com
```

### Available Models

**Configured in Demo UI** (`src/handlers/demo.ts`):

```html
<select id="model-dropdown">
  <option value="groq/openai/gpt-oss-120b">Groq GPT-OSS-120B</option>
  <option value="groq/openai/gpt-oss-20b">Groq GPT-OSS-20B</option>
  <option value="groq/moonshotai/kimi-k2-instruct">Groq Kimi K2 Instruct</option>
  <option value="openrouter/z-ai/glm-4.5-air">OpenRouter GLM-4.5-Air</option>
  <option value="openrouter/z-ai/glm-4.5">OpenRouter GLM-4.5</option>
  <option value="openrouter/qwen/qwen3-coder">OpenRouter Qwen3 Coder</option>
</select>
```

### Error Handling & Fallbacks

**LiteLLM Router** (`litellm_config.yaml`):

```yaml
router_settings:
  routing_strategy: 'least-busy'
  enable_loadbalancing: true
  retry_policy:
    max_retries: 3
    timeout: 30
    exponential_backoff: true
```

## Container Bridge Implementation

### Bridge Architecture

The `ClaudeContainerBridge` class serves as the critical interface layer between the Cloudflare Agent Framework and the Claude Code SDK container runtime.

**Key Components**:

```typescript
export class ClaudeContainerBridge {
  private env: Env

  constructor(env: Env) {
    this.env = env
  }

  async execute(prompt: string, options: ExecutionOptions): Promise<ReadableStream> {
    // 1. Environment configuration
    // 2. Container lifecycle management
    // 3. Request forwarding
    // 4. Response streaming
  }
}
```

### Container Lifecycle Management

**Container Instance Strategy**:

```typescript
// Session-specific container instances with shared workspace
const containerId = `claude-session-${options.sessionId}`
const id = this.env.CLAUDE_CONTAINER.idFromName(containerId)
const container = this.env.CLAUDE_CONTAINER.get(id)
```

**Benefits**:

- **True Session Isolation**: Each sessionId gets dedicated container instance
- **Shared Workspace Persistence**: Container hibernation preserves `/workspace` state
- **Automatic Continuation**: `continueSession: true` enables seamless context preservation
- **Resource Efficiency**: Automatic container hibernation when idle
- **Scalability**: Durable Objects provide automatic scaling
- **Simple Architecture**: No complex session folder management

### Environment Variable Injection

**Configuration Strategy**:

```typescript
const envVars: Record<string, string> = {
  // LiteLLM router configuration
  ANTHROPIC_AUTH_TOKEN: this.env.ANTHROPIC_AUTH_TOKEN || 'auto-detect',
  ANTHROPIC_BASE_URL:
    this.env.ANTHROPIC_BASE_URL || 'https://litellm-router.memorysaver.workers.dev',

  // Model selection (passed through from agent state)
  ANTHROPIC_MODEL: options.model || 'groq/openai/gpt-oss-120b',
}

// API key injection (optional)
if (this.env.ANTHROPIC_API_KEY) {
  envVars.ANTHROPIC_API_KEY = this.env.ANTHROPIC_API_KEY
}
```

### Request/Response Flow

**Request Transformation**:

```typescript
// Agent framework request → Claude Code SDK format
const claudeOptions: ClaudeCodeOptions = {
  prompt, // User input
  model: options.model || 'groq/openai/gpt-oss-120b', // Model selection
  sessionId: options.sessionId, // Session management
  continueSession: true, // Always enabled for sessions
  cwd: '/workspace', // Shared workspace within container
  stream: true, // Real-time streaming
  verbose: false, // Production logging
  maxTurns: 10, // Conversation limits
  permissionMode: 'acceptEdits', // Security policy
  systemPrompt: '', // Empty - let Claude Code use default
}
```

**Response Streaming**:

```typescript
// Container HTTP server response → WebSocket streaming
const response = await container.executeClaudeCode(claudeOptions, envVars)
return response.body! // ReadableStream
```

## Monitoring and Debugging

### Logging Strategy

**Multi-Layer Logging**:

```typescript
// 1. Agent Framework Level
console.log('ClaudeCodeAgent processMessage:', content)

// 2. Container Bridge Level
console.log('🤖 Container Bridge execution:', {
  sessionId: options.sessionId,
  model: options.model,
  workspacePath: options.workspacePath,
})

// 3. Container Runtime Level
console.log('🤖 Claude Code SDK proxy received request')

// 4. SDK Wrapper Level (claude-server.js)
console.log('🤖 Request ID:', requestId)
console.log('🤖 Complete Request Body:', JSON.stringify(requestBody, null, 2))
```

### Health Check Endpoints

**Container Health** (`claude-server.js`):

```javascript
app.get('/', (c) => {
  return c.json({
    status: 'healthy',
    service: 'claude-code-container',
    timestamp: new Date().toISOString(),
  })
})

app.get('/debug', (c) => {
  return c.json({
    apiConfiguration: {
      ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
      ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? '[REDACTED]' : undefined,
    },
    processInfo: {
      uptime: process.uptime(),
      pid: process.pid,
      memoryUsage: process.memoryUsage(),
    },
  })
})
```

### Performance Monitoring

**Key Metrics**:

- **WebSocket Connection Count**: Active real-time sessions
- **Container Instance Count**: Active Claude Code containers
- **Request Processing Time**: End-to-end latency
- **Model Response Time**: LiteLLM router performance
- **Error Rates**: Request failures and retry attempts

**Cloudflare Analytics Integration**:

```typescript
// Built-in observability (wrangler.jsonc)
{
    "observability": {
        "enabled": true
    },
    "logpush": true
}
```

## Security Considerations

### Authentication & Authorization

**Session Isolation**:

- Each WebSocket connection gets unique session ID
- Session-specific Durable Object instances
- Isolated container file systems
- No cross-session data leakage

**API Security**:

```typescript
// Environment variable protection
envVars.ANTHROPIC_API_KEY = this.env.ANTHROPIC_API_KEY // Injected securely
```

### Container Security

**Sandboxing Strategy**:

- Each session runs in isolated container
- File system access limited to session workspace
- Container hibernation prevents resource leaks
- Automatic cleanup of temporary sandboxes

## Troubleshooting Guide

### Common Issues

**1. WebSocket Connection Failures**

```typescript
// Symptom: Connection drops immediately
// Check: Session ID validation in URL path
const sessionId = c.req.param('sessionId')
if (!sessionId) {
  return new Response('Session ID required', { status: 400 })
}
```

**2. Model Selection Not Working**

```typescript
// Symptom: Always uses default model
// Check: Model persistence in agent state
if (model) {
  this.setState({
    ...this.typedState,
    claudeSession: {
      ...this.typedState.claudeSession,
      preferredModel: model,
    },
  })
}
```

**3. Container Startup Issues**

```javascript
// Symptom: "Failed to load Claude Code SDK"
// Check: Container dependencies and image build
RUN npm install --verbose @anthropic-ai/claude-code hono @hono/node-server
```

**4. LiteLLM Routing Failures**

```yaml
# Symptom: Model requests fail with 404
# Check: Model name patterns in litellm_config.yaml
model_list:
  - model_name: groq/*
    litellm_params:
      model: groq/*
      api_base: https://api.groq.com/openai/v1
```

### Debug Commands

**Container Inspection**:

```bash
# View container logs
wrangler tail --format pretty

# Container health check
curl https://your-worker.dev/claude-code/debug
```

**Agent State Inspection**:

```typescript
// Add to WebSocket handler for debugging
const state = await agent.getState()
console.log('Agent State:', JSON.stringify(state, null, 2))
```

## Deployment Configuration

### Wrangler Configuration

**Core Bindings** (`wrangler.jsonc`):

```json
{
  "containers": [
    {
      "max_instances": 5,
      "class_name": "ClaudeCodeContainer",
      "image": "./claude.Dockerfile"
    }
  ],
  "durable_objects": {
    "bindings": [
      {
        "name": "CLAUDE_CONTAINER",
        "class_name": "ClaudeCodeContainer"
      },
      {
        "name": "CLAUDE_CODE_AGENT",
        "class_name": "ClaudeCodeAgent"
      }
    ]
  },
  "vars": {
    "ANTHROPIC_BASE_URL": "https://litellm-router.memorysaver.workers.dev"
  }
}
```

### Environment Variables

**Required Variables**:

- `ANTHROPIC_BASE_URL`: LiteLLM router endpoint
- `ANTHROPIC_AUTH_TOKEN`: Authentication token (optional)
- `ANTHROPIC_API_KEY`: Direct API key (optional)

**Development vs Production**:

```bash
# Development (.dev.vars)
ANTHROPIC_BASE_URL=http://localhost:8787
ANTHROPIC_AUTH_TOKEN=dev-token

# Production (wrangler secrets)
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put ANTHROPIC_AUTH_TOKEN
```

## Performance Optimization

### Container Hibernation

**Strategy**: Containers automatically hibernate after idle periods, preserving file system state while reducing resource usage.

**Configuration**:

```typescript
export class ClaudeCodeContainer extends Container {
  sleepAfter = '10m' // Hibernate after 10 minutes of inactivity
}
```

### Request Batching

**WebSocket Streaming**: Real-time message streaming reduces perceived latency compared to polling.

**Model Caching**: LiteLLM router implements in-memory caching for improved performance.

### Scale Considerations

**Durable Objects Benefits**:

- Automatic geographic distribution
- Session-specific scaling
- Built-in state persistence
- Edge-optimized performance

## Future Enhancements

### Planned Improvements

**1. Multi-Agent Support**

- Extend agent framework for specialized agents
- Agent-to-agent communication patterns
- Centralized agent orchestration

**2. Advanced Session Management**

- Cross-session file sharing
- Session templates and snapshots
- Advanced workspace management

**3. Enhanced Monitoring**

- Real-time performance dashboards
- Advanced error tracking
- Usage analytics and insights

**4. Security Hardening**

- Advanced authentication methods
- Fine-grained permission controls
- Audit logging and compliance

---

## Technical Reference Quick Links

- **Agent Framework**: `src/agents/claude-code-agent.ts`
- **Container Runtime**: `src/claude-container.ts`
- **WebSocket Handler**: `src/handlers/claude-agent.ts`
- **Demo Interface**: `src/handlers/demo.ts`
- **SDK Wrapper**: `claude-server.js`
- **LiteLLM Config**: `../litellm-router/litellm_config.yaml`
- **Deployment Config**: `wrangler.jsonc`

This documentation provides a comprehensive reference for understanding, maintaining, and extending the agent management system architecture.
