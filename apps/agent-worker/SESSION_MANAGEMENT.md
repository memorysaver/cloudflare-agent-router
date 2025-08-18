# Claude Code Session Management: Session Folder Sandboxing

## Architecture Overview

**Core Concept**: Session-based filesystem sandboxing with future R2 persistence

### Session Folder Structure

```
Container Filesystem:
/sessions/
├── {sessionId-1}/                    # Session sandbox folder
│   ├── workspace/                    # Claude Code working directory
│   ├── .claude/                      # Claude Code metadata/history
│   ├── temp/                         # Temporary files
│   └── .session_metadata             # Session info (optional)
├── {sessionId-2}/                    # Another session sandbox
│   └── ...
└── cleanup/                          # Staging for cleanup operations
```

### Session Lifecycle

1. **API Request** → Session ID provided or generated
2. **Folder Creation** → `/sessions/{sessionId}/` created if not exists
3. **Claude Code Execution** → `cwd: /sessions/{sessionId}/workspace`
4. **File Isolation** → All edits contained in session folder
5. **Future: R2 Archive** → Tar/zip entire session folder to R2

## Implementation Plan

### Phase 1: Session Folder Implementation

#### 1. Enhanced API Interface (Backward Compatible)

```typescript
export interface ClaudeCodeRequest {
  prompt: string
  sessionId?: string              // Optional: provide to resume/create session
  // ... all existing fields unchanged
}

export interface ClaudeCodeResponse {
  // ... existing fields
  sessionId: string               // Session ID (created or provided)
  sessionCreated: boolean         // true if new session folder created
  sessionPath: string             # Session folder path (for debugging)
}
```

#### 2. Session ID Strategy

- **Format**: `{timestamp}_{random8}` (e.g., `20241218_a1b2c3d4`)
- **Generation**: In API handler, not Claude Code
- **Validation**: Alphanumeric + underscore/hyphen, 15-30 chars
- **User Control**: Must provide sessionId to resume existing session

#### 3. Core Session Logic

```typescript
function resolveSession(sessionId?: string): SessionInfo {
  if (sessionId) {
    // User provided - use existing or create new folder
    const sessionPath = `/sessions/${sessionId}/workspace`
    const created = !folderExists(sessionPath)
    if (created) createSessionFolder(sessionPath)
    return { sessionId, sessionPath, created }
  } else {
    // Generate new session
    const newSessionId = generateSessionId()
    const sessionPath = `/sessions/${newSessionId}/workspace`
    createSessionFolder(sessionPath)
    return { sessionId: newSessionId, sessionPath, created: true }
  }
}
```

### Files to Modify

#### 1. **`handlers/claude-code.ts`**

- Add `sessionId?` to `ClaudeCodeRequest`
- Add session metadata to response
- Pass resolved sessionId to container

#### 2. **`claude-container.ts`**

- Add session folder resolution in `executeClaudeCode()`
- Override `cwd` parameter: `/sessions/{sessionId}/workspace`
- Handle session folder creation

#### 3. **`claude-server.js`**

- Add `ensureSessionFolder()` function
- Generate session ID if not provided
- Override Claude Code SDK `cwd` option
- Include session info in responses

#### 4. **New: `SESSION_MANAGEMENT.md`**

- Complete documentation of session architecture
- API usage examples
- Phase 1 vs Phase 2 capabilities
- R2 integration roadmap

### Phase 2: R2 Integration (Future)

#### Session Persistence Strategy

```typescript
// Archive session to R2
async function archiveSession(sessionId: string) {
  const sessionPath = `/sessions/${sessionId}`
  const tarGz = await createTarGz(sessionPath)
  await R2_BUCKET.put(`sessions/${sessionId}.tar.gz`, tarGz)
}

// Restore session from R2
async function restoreSession(sessionId: string) {
  const archive = await R2_BUCKET.get(`sessions/${sessionId}.tar.gz`)
  if (archive) {
    await extractTarGz(archive, `/sessions/${sessionId}`)
    return true
  }
  return false
}
```

#### Enhanced Session Flow (Phase 2)

1. **Session Request** → Check local folder first
2. **Not Found Locally** → Try restore from R2
3. **Execute Claude Code** → In session folder
4. **Archive on Idle** → Upload changes to R2
5. **Cleanup Local** → Remove local folder after archiving

## Benefits

### ✅ **Simple & Future-Proof**

- Minimal changes to existing codebase
- No complex Claude Code SDK modifications
- Clean migration path to R2 persistence

### ✅ **Perfect Session Isolation**

- Each session gets dedicated filesystem sandbox
- No cross-session file contamination
- Natural working directory separation

### ✅ **R2-Ready Architecture**

- Session folders map directly to R2 archives
- Simple tar/zip entire folder for persistence
- Easy restore by extracting archive

### ✅ **Container Restart Tolerance**

- Phase 1: Accept session loss on restart (fine for development)
- Phase 2: Automatic restore from R2 (production ready)

### ✅ **User Control**

- Explicit session management (no magic auto-continuation)
- Users must provide sessionId to resume
- Clear session lifecycle

## Implementation Priority

**High Priority (Phase 1)**:

1. Session folder creation and management
2. Claude Code working directory override
3. API interface updates
4. Session ID generation and validation

**Medium Priority (Phase 2)**:

1. R2 bucket integration
2. Session archiving and restoration
3. Automatic cleanup policies
4. Session size monitoring

**Low Priority (Phase 3)**:

1. Session sharing capabilities
2. Session analytics and metrics
3. Advanced cleanup and optimization
4. Session metadata and tagging

## API Usage Examples

### Create New Session

```javascript
const response = await fetch('/api/claude-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Create a new Python project',
    // No sessionId provided - creates new session
  }),
})

const result = await response.json()
console.log(result.sessionId) // "20241218_a1b2c3d4"
console.log(result.sessionCreated) // true
```

### Resume Existing Session

```javascript
const response = await fetch('/api/claude-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Add a test file to the project',
    sessionId: '20241218_a1b2c3d4', // Resume previous session
  }),
})

const result = await response.json()
console.log(result.sessionId) // "20241218_a1b2c3d4" (same session)
console.log(result.sessionCreated) // false (existing session)
```

### Using Claude Code SDK Style

```javascript
import { query } from '@anthropic-ai/claude-code'

// New session
for await (const message of query({
  prompt: 'Create a React component',
  options: {
    // No sessionId - creates new session
  },
})) {
  if (message.type === 'result') {
    console.log('Session ID:', message.sessionId)
  }
}

// Resume session
for await (const message of query({
  prompt: 'Add TypeScript to the component',
  options: {
    sessionId: '20241218_a1b2c3d4', // Resume specific session
  },
})) {
  if (message.type === 'result') {
    console.log('Continued session:', message.sessionId)
  }
}
```

This architecture provides a clean, simple foundation that naturally evolves into a robust R2-based persistence system while maintaining full backward compatibility.
