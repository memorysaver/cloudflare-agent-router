# Claude Code Session Management: Shared Workspace Architecture

## Architecture Overview

**Core Concept**: Session ID → Container Isolation → Shared Workspace → Auto-Continue

### New Session Architecture Design

```
sessionId: "demo-abc123"
    ↓ (creates dedicated container)
Container: claude-session-demo-abc123
    ↓ (shared workspace for all requests)
Workspace: /workspace (persistent across requests)
    ↓ (automatic session continuation)
Claude CLI Wrapper: --continue/--resume flags
```

### Key Design Principles

1. **Session ID Isolation**: Each sessionId gets its own dedicated container instance
2. **Per Container**: Container named `claude-session-{sessionId}` for true isolation
3. **One Workspace**: All operations within a session use shared `/workspace` directory
4. **Auto Continue**: `continueSession: true` automatically maintains context and file state
5. **No Session Folders**: Eliminated complex `/sessions/{sessionId}/` directory structure

## Session Lifecycle

### Simplified Flow

1. **API Request** → sessionId provided (e.g., `"demo-abc123"`)
2. **Container Selection** → Get/create `claude-session-demo-abc123` container
3. **Workspace Setup** → Ensure `/workspace` directory exists in container
4. **Claude Code Execution** → `cwd: /workspace`, `continueSession: true`
5. **File Persistence** → All files persist across requests in shared workspace
6. **Context Continuation** → Claude automatically sees previous files and context

## Implementation Details

### API Interface (Updated)

```typescript
export interface ClaudeCodeRequest {
  prompt: string
  sessionId?: string // Session ID for container isolation and auto-continue
  // ... all existing fields unchanged
  continueSession?: boolean // Auto-enabled when sessionId provided
  cwd?: string // Overridden to /workspace for sessions
}

export interface ClaudeCodeResponse {
  type: 'result'
  result: string
  sessionId: string // Session ID used
  requestId: string
  // ... existing fields
}
```

### Core Session Logic

```typescript
function resolveSessionContainer(sessionId?: string): ContainerInfo {
  if (sessionId) {
    // Use session-specific container with shared workspace
    const containerId = `claude-session-${sessionId}`
    const id = env.CLAUDE_CONTAINER.idFromName(containerId)
    const container = env.CLAUDE_CONTAINER.get(id)
    return { container, workspace: '/workspace', sessionId }
  } else {
    // Use default container for non-session requests
    const containerId = 'claude-execution'
    const id = env.CLAUDE_CONTAINER.idFromName(containerId)
    const container = env.CLAUDE_CONTAINER.get(id)
    return { container, workspace: undefined, sessionId: undefined }
  }
}
```

### Container Session Configuration

```typescript
// In ClaudeContainerBridge
async execute(prompt: string, options: {
  sessionId: string
  model?: string
}): Promise<ReadableStream> {
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
  }

  // Get session-specific container instance
  const containerId = `claude-session-${options.sessionId}`
  const id = this.env.CLAUDE_CONTAINER.idFromName(containerId)
  const container = this.env.CLAUDE_CONTAINER.get(id)

  // Execute and return stream
  const response = await container.executeClaudeCode(claudeOptions, envVars)
  return response.body!
}
```

## Benefits of New Architecture

### ✅ **Simplified Design**

- **No Session Folders**: Eliminated complex `/sessions/{sessionId}/workspace` structure
- **Container Isolation**: Each session gets dedicated container for true isolation
- **Shared Workspace**: Simple `/workspace` path for all operations within a session
- **Auto-Continue**: Claude CLI wrapper handles session continuation automatically

### ✅ **Perfect Session Isolation**

- **Container-Level Isolation**: Each sessionId gets its own container instance
- **No Cross-Session Contamination**: Containers are completely isolated from each other
- **Persistent Workspace**: Files created in one request visible in subsequent requests
- **Natural File State**: Claude automatically sees and works with existing files

### ✅ **Developer Experience**

- **Predictable Behavior**: Sessions always continue, files always persist
- **Simple API**: Just pass sessionId, everything else is automatic
- **Real-Time Updates**: WebSocket streaming with immediate file state changes
- **Debugging Friendly**: Each session has its own container for easy inspection

### ✅ **Operational Benefits**

- **Container Hibernation**: Containers hibernate when idle, preserving file state
- **Resource Efficient**: Only active sessions consume resources
- **Scalable Architecture**: Durable Objects provide automatic scaling
- **Easy Monitoring**: Session-specific containers enable precise debugging

## Removed Complexity

### ❌ **No More Session Folders**

```diff
- /sessions/
- ├── {sessionId-1}/
- │   ├── workspace/
- │   ├── .claude/
- │   └── temp/
- └── {sessionId-2}/
-     └── workspace/

+ Container: claude-session-{sessionId}
+ Workspace: /workspace (simple and direct)
```

### ❌ **No More Complex Session Management**

```diff
- function ensureSessionFolder(sessionId, isTemp) {
-   const sessionPath = `/sessions/${sessionId}/workspace`
-   fs.mkdirSync(sessionPath, { recursive: true })
-   return { workspacePath: sessionPath }
- }

+ // Simple shared workspace setup
+ const sessionWorkspacePath = '/workspace'
+ fs.mkdirSync(sessionWorkspacePath, { recursive: true })
```

### ❌ **No More Temp Sandbox Renaming**

```diff
- const sandboxId = generateSandboxId()
- const { workspacePath } = ensureSessionFolder(sandboxId, true)
- // ... later rename temp sandbox to permanent session
- renameSessionFolder(sandboxId, capturedSessionId)

+ // Direct session container usage
+ const containerId = `claude-session-${sessionId}`
+ // No renaming needed - container persists for entire session
```

## Session Continuation Examples

### Basic Session Flow

```bash
# Request 1: Create a file (creates container claude-session-demo-abc123)
curl -X POST http://localhost:8788/claude-code \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a hello.py file with print(\"Hello World\")",
    "sessionId": "demo-abc123"
  }'

# Request 2: Modify the file (uses existing container and workspace)
curl -X POST http://localhost:8788/claude-code \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Add error handling to hello.py",
    "sessionId": "demo-abc123"
  }'

# Request 3: List files (Claude sees previous files automatically)
curl -X POST http://localhost:8788/claude-code \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What files exist in my workspace?",
    "sessionId": "demo-abc123"
  }'
```

### Demo Interface Integration

```javascript
// Demo UI automatically generates session UUID and passes it
const sessionId = crypto.randomUUID() // "550e8400-e29b-41d4-a716-446655440000"

// WebSocket connection to session-specific agent
const ws = new WebSocket(`ws://localhost:8788/demo/ws/${sessionId}`)

// All messages in this session use the same container and workspace
ws.send(
  JSON.stringify({
    type: 'user_message',
    content: 'Create a React component',
    model: 'groq/openai/gpt-oss-120b',
  })
)

// Later messages in same session see previous files
ws.send(
  JSON.stringify({
    type: 'user_message',
    content: 'Add TypeScript to the component',
  })
)
```

## Troubleshooting

### Session Continuity Issues

**Symptoms**: Files created in previous requests are not visible

**Debug Steps**:

1. **Verify sessionId consistency**: Ensure same sessionId used across requests
2. **Check container exists**: `docker ps --filter "name=claude-session-demo-abc123"`
3. **Inspect workspace**: `docker exec claude-session-demo-abc123 ls -la /workspace`
4. **Verify auto-continue**: Should be automatically enabled with sessionId

### Container Debugging

```bash
# Find session-specific containers
docker ps --filter "name=claude-session-" --format "table {{.Names}}\t{{.Status}}"

# Check workspace contents for specific session
docker exec claude-session-demo-abc123 ls -la /workspace

# View container logs
docker logs claude-session-demo-abc123

# Interactive debugging session
docker exec -it claude-session-demo-abc123 /bin/bash
```

### Common Issues

**Problem**: Session doesn't continue despite passing sessionId
**Solution**: Verify `continueSession: true` is set and sessionId format is valid

**Problem**: Files disappear between requests
**Solution**: Check that the same container is being used (`docker ps` to verify)

**Problem**: Multiple containers for same session
**Solution**: Review container ID generation logic (`claude-session-${sessionId}`)

## Migration from Old Architecture

### Key Changes Made

1. **Removed Session Folders**: No more `/sessions/{sessionId}/workspace` structure
2. **Added Container Isolation**: Each sessionId gets dedicated container
3. **Simplified Workspace**: Always use `/workspace` within container
4. **Enabled Auto-Continue**: `continueSession: true` by default with sessionId
5. **Eliminated Temp Sandboxes**: No more temporary folder creation and renaming

### Code Changes Summary

```typescript
// OLD: Complex session folder management
const sessionPath = `/sessions/${sessionId}/workspace`
createSessionFolder(sessionPath)

// NEW: Simple shared workspace with container isolation
const containerId = `claude-session-${sessionId}`
const workspace = '/workspace'
```

This new architecture provides the perfect balance of session isolation (through containers) and simplicity (through shared workspace), resulting in predictable, reliable session continuation behavior.
