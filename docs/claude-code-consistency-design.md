# Unified Claude Code API Architecture

## Problem Analysis
Current architecture has duplicate code and inconsistent interfaces between `/agent/message` and `/claude-code` endpoints:

### Current Issues:
- **Duplicate Interface Definitions**: `ClaudeCodeRequest` defined in both `claude-code.ts` and `claude-container.ts`
- **Inconsistent Parameter Support**: `/claude-code` accepts 20+ parameters, `/agent/message` only accepts `{message, sessionId}`
- **Hardcoded Parameters**: Agent container bridge hardcodes `permissionMode: 'acceptEdits'` instead of using request values
- **Duplicate Validation Logic**: Parameter validation and defaulting duplicated across handlers
- **Different Error Handling**: Inconsistent error response formats

## Target Architecture

### Unified Call Stack:
```
┌─────────────────┐    ┌─────────────────┐
│  /agent/message │    │   /claude-code  │
│                 │    │                 │
│ ClaudeCodeReq + │    │  ClaudeCodeReq  │
│ Agent Persist   │    │   Direct Call   │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          └──────────┬───────────┘
                     │
            ┌────────▼────────┐
            │ ClaudeCodeService│ (shared core)
            │                 │
            │ • validateReq   │
            │ • processParams │
            │ • mapToCliArgs  │
            │ • executeStream │
            │ • executeNonStr │
            └────────┬────────┘
                     │
            ┌────────▼────────┐
            │ ClaudeContainer │
            └─────────────────┘
```

## Implementation Plan

### Phase 1: Extract Shared Types & Service

#### 1.1 Create Shared Types (`src/types/claude-code.ts`)
```typescript
// Move ClaudeCodeRequest interface here (single source)
// Move ClaudeCodeError interface here
// Add utility types for processed options
```

#### 1.2 Create Claude Code Service (`src/services/claude-code.service.ts`)
```typescript
export class ClaudeCodeService {
  // Shared validation and processing logic
  validateAndProcessRequest(request: ClaudeCodeRequest): ProcessedClaudeCodeOptions
  
  // Shared execution methods  
  executeStreaming(options: ProcessedOptions, envVars: EnvVars): Promise<Response>
  executeNonStreaming(options: ProcessedOptions, envVars: EnvVars): Promise<any>
  
  // Shared environment variable preparation
  prepareEnvironment(context: App): EnvVars
}
```

### Phase 2: Update /claude-code Handler

#### 2.1 Refactor `handleClaudeCode()` to use shared service
- Remove duplicate validation logic (lines 81-108, 144-187)
- Use `ClaudeCodeService.validateAndProcessRequest()`
- Use `ClaudeCodeService.executeStreaming()`
- Keep existing behavior identical for backward compatibility

### Phase 3: Unify /agent/message Handler

#### 3.1 Update Agent Request Interface
```typescript
// Support both legacy and new formats
type AgentRequest = 
  | { message: string, sessionId?: string }  // Legacy format
  | ClaudeCodeRequest                        // New unified format
```

#### 3.2 Add Backward Compatibility Layer
```typescript
function normalizeAgentRequest(body: any): ClaudeCodeRequest {
  if (body.message) {
    // Convert legacy {message, sessionId} to ClaudeCodeRequest
    return {
      prompt: body.message,
      sessionId: body.sessionId,
      // Apply standard defaults
      permissionMode: 'acceptEdits',
      maxTurns: 10,
      // ... other defaults
    }
  }
  // New format - use as-is
  return body as ClaudeCodeRequest
}
```

#### 3.3 Update `handleAgentMessage()` 
- Accept full `ClaudeCodeRequest` parameters
- Use `ClaudeCodeService.validateAndProcessRequest()`
- Support both streaming and non-streaming based on `outputFormat`
- Maintain agent state persistence for non-streaming mode

#### 3.4 Update `ClaudeCodeAgent.processMessage()`
- Remove hardcoded parameters from container bridge calls
- Accept full `ClaudeCodeRequest` instead of just message string
- Pass through all parameters to container execution

### Phase 4: Remove Container Bridge Duplication

#### 4.1 Replace `ClaudeContainerBridge` class
- Remove `executeStreaming()` and `executeNonStreaming()` methods
- Use shared `ClaudeCodeService` instead
- Eliminate 100+ lines of duplicate container interaction code

#### 4.2 Remove Duplicate Interfaces
- Delete `ClaudeCodeOptions` from `claude-container.ts`
- Use shared types from `src/types/claude-code.ts`

### Phase 5: Unified Streaming Support

#### 5.1 Both endpoints support streaming modes:
- `outputFormat: 'stream-json'` → Return streaming `Response`
- `outputFormat: 'json'` → Return processed JSON result

#### 5.2 Agent-specific behavior:
- **Streaming mode**: Direct response (like `/claude-code`)
- **Non-streaming mode**: Store result in agent state + return status

## Expected API Changes

### /agent/message Endpoint (New Capabilities)
```javascript
// Current (still supported)
POST /agent/message
{
  "message": "Use WebFetch to get https://httpbin.org/json",
  "sessionId": "test123"
}

// New unified format (same as /claude-code)
POST /agent/message  
{
  "prompt": "Use WebFetch to get https://httpbin.org/json",
  "sessionId": "test123",
  "permissionMode": "bypassPermissions",  // 🎯 This now works!
  "maxTurns": 5,
  "model": "claude-3-haiku",
  "outputFormat": "json"
  // ... all other ClaudeCodeRequest parameters
}
```

### /claude-code Endpoint (No Changes)
```javascript
// Existing interface unchanged - maintains backward compatibility
POST /claude-code
{
  "prompt": "Use WebFetch to get https://httpbin.org/json", 
  "permissionMode": "bypassPermissions",
  "sessionId": "test123"
  // ... existing parameters work identically
}
```

## Benefits Achieved

✅ **Single Source of Truth**: One interface, one validation, one CLI parameter mapping  
✅ **Consistent API Surface**: Both endpoints accept identical `ClaudeCodeRequest` parameters  
✅ **Reduced Code Duplication**: Eliminate ~200 lines of duplicate validation/processing logic  
✅ **Enhanced /agent/message**: Gains all rich parameter support (permissionMode, model, maxTurns, etc.)  
✅ **Backward Compatibility**: Existing integrations continue to work without changes  
✅ **Unified Streaming**: Both endpoints support streaming/non-streaming via `outputFormat`  
✅ **Better Maintainability**: Parameter changes only need to be made in shared service  

## Files to Create/Modify

### New Files:
- `src/types/claude-code.ts` - Shared interfaces
- `src/services/claude-code.service.ts` - Shared business logic

### Modified Files:
- `src/handlers/claude-code.ts` - Use shared service
- `src/handlers/claude-agent.ts` - Accept full parameters + backward compatibility  
- `src/agents/claude-code-agent.ts` - Remove container bridge, use shared service
- `src/claude-container.ts` - Remove duplicate interface definitions

### Deleted Code:
- `ClaudeContainerBridge` class (~150 lines)
- Duplicate `ClaudeCodeOptions` interface  
- Duplicate parameter validation logic

## Migration Strategy

1. **Phase 1-2**: Create shared code alongside existing (no breaking changes)
2. **Phase 3**: Test /claude-code with shared service (should be identical behavior)  
3. **Phase 4**: Update /agent/message with backward compatibility
4. **Phase 5**: Remove old duplicate code after validation
5. **Testing**: Integration tests verify identical behavior + new functionality

This achieves the goal of **consistent call stack** and **single source of truth** while maintaining the agent persistence layer benefits.

## Current Call Stack Analysis

### /claude-code endpoint (WORKS):
```
handleClaudeCode() 
├─ Extract permissionMode from request JSON ✅
├─ Apply parameter defaults and validation ✅  
├─ container.executeClaudeCode(options, envVars) ✅
└─ ClaudeCodeContainer forwards complete options ✅
```

### /agent/message endpoint (BROKEN):
```
handleAgentMessage() 
├─ Only extracts {message, sessionId} from JSON ❌
├─ agent.processMessage(message, sessionId) ❌
├─ containerBridge.executeNonStreaming() ❌
│  └─ Hardcodes permissionMode: 'acceptEdits' ❌
└─ Same container path but wrong permissionMode ❌
```

### After Unification (TARGET):
```
Both endpoints:
├─ Accept full ClaudeCodeRequest parameters ✅
├─ ClaudeCodeService.validateAndProcessRequest() ✅
├─ ClaudeCodeService.execute() ✅
└─ Same container execution with correct parameters ✅

Difference: /agent adds persistence layer on top
```