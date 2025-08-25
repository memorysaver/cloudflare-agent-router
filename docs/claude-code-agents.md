# Claude Code Agent Framework Integration Design

## Overview

This document outlines the integration of Claude Code SDK with Cloudflare's Agent Framework to provide enhanced session management, real-time WebSocket communication, and improved user experience while preserving the existing container infrastructure.

## Architecture Comparison

### Current Architecture (REST API)

```
Web UI → agent-worker (REST API) → ClaudeCodeContainer (Durable Object) → Container Runtime → Claude Code CLI
```

**Limitations:**

- REST API requires polling for updates
- No real-time progress indicators
- Basic session management
- Limited error recovery
- No WebSocket streaming

### Proposed Architecture (Agent Framework)

```
Web UI → agent-worker (WebSocket) → ClaudeCodeAgent (Durable Object) → Container Runtime → Claude Code CLI
```

**Benefits:**

- Real-time WebSocket communication
- Enhanced session management with agent framework
- Streaming progress indicators
- Better error handling and recovery
- Modern React hooks integration
- Scalable edge architecture

## Detailed Call Stack

### 1. User Interaction Flow

```
User Input (Web UI)
    ↓ WebSocket Message
Agent Framework Router
    ↓ Message Processing
ClaudeCodeAgent.processMessage()
    ↓ Session Context
Container Execution Layer
    ↓ CLI Execution
Claude Code SDK
    ↓ Streaming Response
Output Parser
    ↓ Structured Messages
Agent Framework State
    ↓ WebSocket Stream
Real-time UI Updates
```

### 2. Component Interaction Details

#### **Web UI Layer**

- **Technology**: React + Cloudflare Agent Framework Hooks
- **Connection**: WebSocket to ClaudeCodeAgent
- **State**: Real-time message updates, progress indicators
- **Features**: Chat interface, streaming responses, session management

#### **ClaudeCodeAgent (Durable Object)**

- **Extends**: `AIChatAgent<Env>` from Cloudflare agent framework
- **Responsibilities**:
  - Session state management in Durable Object storage
  - WebSocket connection handling
  - Message processing and validation
  - Container lifecycle management
  - Output parsing and streaming
- **State Schema**:
  ```typescript
  interface AgentSessionState {
    // Agent framework standard state
    messages: Message[]
    isRunning: boolean
    lastActivity: number

    // Claude Code specific state
    claudeSession: {
      id: string
      workspacePath: string
      lastCommand: string
      sessionFiles: string[]
      activeTools: string[]
    }

    // Container management
    containerState: {
      isActive: boolean
      lastHeartbeat: number
      resourceUsage: ContainerMetrics
    }
  }
  ```

#### **Container Execution Layer**

- **Technology**: `@cloudflare/containers` (existing)
- **Responsibilities**:
  - Claude Code CLI execution
  - Filesystem management for sessions
  - Resource isolation and management
  - Output streaming
- **Integration**: Receives execution context from ClaudeCodeAgent

#### **Output Processing Pipeline**

1. **Raw CLI Output** → Container streams raw text/ANSI
2. **Output Parser** → Converts CLI output to structured messages
3. **Message Types**:
   - `progress`: Task progress updates
   - `result`: Command results and outputs
   - `error`: Error messages and stack traces
   - `tool_use`: Tool execution notifications
   - `file_change`: File modification events

## Component Specifications

### ClaudeCodeAgent Class

```typescript
export class ClaudeCodeAgent extends AIChatAgent<Env> {
  private containerBridge: ClaudeContainerBridge
  private sessionManager: ClaudeSessionManager
  private outputParser: ClaudeOutputParser

  /**
   * Process incoming user messages
   */
  async processMessage(content: string): Promise<void> {
    // 1. Add user message to agent state
    await this.addMessage({
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    })

    // 2. Update running state
    await this.setState({ isRunning: true })

    try {
      // 3. Execute Claude Code via container
      const executionStream = await this.containerBridge.execute(content, {
        sessionId: this.sessionManager.getSessionId(),
        workspacePath: this.sessionManager.getWorkspacePath(),
        context: this.getConversationContext(),
      })

      // 4. Process streaming output
      await this.processClaudeStream(executionStream)
    } catch (error) {
      await this.handleError(error)
    } finally {
      await this.setState({ isRunning: false })
    }
  }

  /**
   * Process streaming output from Claude Code
   */
  private async processClaudeStream(stream: ReadableStream): Promise<void> {
    const reader = stream.getReader()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += new TextDecoder().decode(value)
        const messages = this.outputParser.parseBuffer(buffer)

        for (const message of messages) {
          await this.addMessage(message)
          await this.broadcast(message) // Real-time WebSocket update
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * Get conversation context for Claude Code
   */
  private getConversationContext(): string {
    const recentMessages = this.messages.slice(-10) // Last 10 messages
    return recentMessages.map((m) => `${m.role}: ${m.content}`).join('\n')
  }
}
```

### ClaudeContainerBridge

```typescript
export class ClaudeContainerBridge {
  private container: Container

  /**
   * Execute Claude Code with agent context
   */
  async execute(prompt: string, options: ClaudeExecutionOptions): Promise<ReadableStream> {
    // Prepare Claude Code execution options
    const claudeOptions = {
      prompt,
      sessionId: options.sessionId,
      cwd: options.workspacePath,
      stream: true,
      verbose: false,
      maxTurns: 10,
      permissionMode: 'acceptEdits' as const,
      // Include conversation context as system prompt appendix
      appendSystemPrompt: `Previous conversation context:\n${options.context}`,
    }

    // Start container if not running
    if (!this.container || !this.container.isRunning) {
      this.container = new Container()
      await this.container.start()
    }

    // Execute Claude Code
    const request = new Request('http://localhost:3000/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(claudeOptions),
    })

    const response = await this.container.fetch(request)
    return response.body!
  }
}
```

### ClaudeOutputParser

```typescript
export class ClaudeOutputParser {
  private buffer: string = ''
  private messageQueue: Message[] = []

  /**
   * Parse streaming CLI output into structured messages
   */
  parseBuffer(newData: string): Message[] {
    this.buffer += newData
    const lines = this.buffer.split('\n')

    // Keep last incomplete line in buffer
    this.buffer = lines.pop() || ''

    const messages: Message[] = []

    for (const line of lines) {
      const message = this.parseLine(line)
      if (message) {
        messages.push(message)
      }
    }

    return messages
  }

  /**
   * Parse individual line into message
   */
  private parseLine(line: string): Message | null {
    // Remove ANSI escape codes
    const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '')

    // Skip empty lines
    if (!cleanLine.trim()) return null

    // Detect message type and parse accordingly
    if (cleanLine.startsWith('🔧 ')) {
      return {
        id: generateId(),
        role: 'assistant',
        content: cleanLine.substring(2).trim(),
        type: 'tool_use',
        timestamp: Date.now(),
      }
    } else if (cleanLine.startsWith('❌ ')) {
      return {
        id: generateId(),
        role: 'assistant',
        content: cleanLine.substring(2).trim(),
        type: 'error',
        timestamp: Date.now(),
      }
    } else if (cleanLine.includes('file:')) {
      return {
        id: generateId(),
        role: 'assistant',
        content: cleanLine,
        type: 'file_change',
        timestamp: Date.now(),
      }
    } else {
      return {
        id: generateId(),
        role: 'assistant',
        content: cleanLine,
        type: 'result',
        timestamp: Date.now(),
      }
    }
  }
}
```

## State Management Strategy

### Agent Framework State

- **Storage**: Durable Object persistent storage
- **Structure**: Message-based conversation history
- **Synchronization**: Real-time WebSocket updates
- **Persistence**: Automatic across browser sessions

### Claude Code Session State

- **Storage**: Container filesystem
- **Structure**: Session directories with workspace files
- **Persistence**: Container hibernation/awakening
- **Integration**: Session ID mapping between agent and Claude Code

### State Synchronization Flow

1. **User Message** → Agent adds to message history
2. **Claude Code Execution** → Updates container session state
3. **Output Processing** → Parser converts to agent messages
4. **State Update** → Agent broadcasts to connected clients
5. **Persistence** → Both systems save state independently

## Implementation Phases

### Phase 1: Agent Framework Foundation (Week 1-2)

**Objectives**: Set up basic agent framework integration with demo interface

**Tasks**:

- [ ] Install Cloudflare agents package in agent-worker
- [ ] Create `ClaudeCodeAgent` class extending `AIChatAgent`
- [ ] Implement basic Durable Object session management
- [ ] Set up WebSocket communication infrastructure
- [ ] Create simple message processing pipeline
- [ ] Add demo routes to Hono app (`GET /demo`, `GET /demo/ws`)

**Deliverables**:

- Working `ClaudeCodeAgent` with basic WebSocket communication
- Simple demo chat interface served by agent-worker
- Basic session state management

### Phase 2: Container Integration (Week 2-3)

**Objectives**: Integrate existing container infrastructure with agent framework

**Tasks**:

- [ ] Implement `ClaudeContainerBridge` class
- [ ] Modify container interface to accept agent context
- [ ] Create `ClaudeOutputParser` for CLI-to-message conversion
- [ ] Implement streaming output processing
- [ ] Add error handling and recovery
- [ ] Enhance demo interface with real-time message display

**Deliverables**:

- Working container execution via agent framework
- Streaming CLI output converted to agent messages
- Error handling and recovery mechanisms
- Functional demo interface with message streaming

### Phase 3: Demo Interface Enhancement (Week 3-4)

**Objectives**: Create comprehensive demo interface with agent features

**Tasks**:

- [ ] Implement message type handling (progress, results, errors, file changes)
- [ ] Add visual indicators (loading, progress bars, status)
- [ ] Create agent configuration options (model selection, permissions)
- [ ] Implement session persistence in demo interface
- [ ] Add message timestamps and metadata display
- [ ] Create tool usage visualization

**Deliverables**:

- Feature-complete demo interface
- Real-time message streaming with different types
- Agent configuration controls
- Session management in demo

### Phase 4: Advanced Agent Features (Week 4-5)

**Objectives**: Advanced session features and agent capabilities

**Tasks**:

- [ ] Implement `ClaudeSessionManager` for session coordination
- [ ] Add session persistence and recovery
- [ ] Implement conversation context passing
- [ ] Add session analytics and monitoring
- [ ] Optimize container lifecycle management
- [ ] Create agent configuration system for future extensibility

**Deliverables**:

- Robust session management across container restarts
- Conversation context preservation
- Agent configuration foundation for future multi-agent system

### Phase 5: Testing and Documentation (Week 5-6)

**Objectives**: Comprehensive testing and preparation for multi-agent expansion

**Tasks**:

- [ ] Write comprehensive test suite
- [ ] Performance testing and optimization
- [ ] Load testing with multiple concurrent sessions
- [ ] Documentation for demo interface usage
- [ ] Document agent extension patterns for future agents
- [ ] Prepare integration guidelines for `/apps/web` expansion

**Deliverables**:

- Comprehensive test coverage
- Performance benchmarks
- Demo interface documentation
- Architecture guide for future multi-agent implementation

## Migration Strategy

### Current State Assessment

- **REST API Endpoints**: `/claude-code` POST endpoint
- **Session Management**: Basic filesystem-based approach
- **Container Architecture**: Working Durable Object + Container setup
- **Web UI**: Basic form-based interface

### Migration Approach

#### Option 1: Parallel Implementation (Recommended)

1. **Implement agent framework alongside existing REST API**
2. **Add feature flag to switch between implementations**
3. **Gradual migration of functionality**
4. **Deprecate REST API after full feature parity**

#### Option 2: Direct Replacement

1. **Replace REST handlers with agent framework**
2. **Migrate existing sessions to agent format**
3. **Update web UI in single deployment**

### Migration Steps

1. **Implement ClaudeCodeAgent with feature flag**
2. **Add agent framework endpoints alongside REST**
3. **Update web UI to support both modes**
4. **Test with subset of users**
5. **Gradually increase agent framework usage**
6. **Deprecate REST API after validation**

## Demo Interface Strategy

### **Agent-Worker Demo Integration**

Instead of building the full multi-agent dashboard immediately, we'll start with a focused demo interface within the agent-worker itself:

#### **Project Structure Update**

```
apps/agent-worker/
├── src/
│   ├── index.ts (add demo routes)
│   ├── claude-container.ts (existing)
│   ├── handlers/
│   │   ├── claude-code.ts (existing REST handler)
│   │   ├── claude-agent.ts (NEW - WebSocket agent handler)
│   │   └── demo.ts (NEW - demo interface handler)
│   ├── demo/
│   │   ├── index.html (NEW - demo chat interface)
│   │   ├── client.js (NEW - WebSocket client code)
│   │   └── styles.css (NEW - minimal styling)
│   └── agents/
│       └── claude-code-agent.ts (NEW - ClaudeCodeAgent implementation)
```

#### **Demo Routes in Hono App**

```typescript
// Add to apps/agent-worker/src/index.ts
app
  .get('/demo', handleDemo) // Serve demo interface
  .get('/demo/ws', handleAgentWS) // WebSocket endpoint
  .post('/claude-code', handleClaudeCode) // Existing REST API
```

#### **Simple Demo Interface Features**

1. **Single-Page Chat Interface**: Vanilla HTML/JS for simplicity
2. **WebSocket Communication**: Direct connection to ClaudeCodeAgent
3. **Message Type Display**: Progress, results, errors, file changes
4. **Agent Configuration**: Basic model and permission settings
5. **Session Persistence**: Maintain chat history across refreshes

### **Benefits of This Approach**

- **Self-Contained**: Everything runs within agent-worker
- **Proof of Concept**: Validates ClaudeCodeAgent integration
- **Development Tool**: Useful for testing and debugging
- **Future Foundation**: Provides architecture for full multi-agent dashboard
- **Backward Compatible**: Existing REST API remains functional

### **Future Multi-Agent Dashboard (/apps/web)**

Once the demo interface proves the concept, we'll expand to the full multi-agent dashboard:

## UI Integration Strategy (Future Implementation)

Based on research of Cloudflare agents and Vercel AI SDK integration, here's how the web UI will connect to our agent framework:

### **Multi-Agent Dashboard Architecture**

Your `/apps/web` will become a **multi-agent dashboard** that can integrate with different specialized agents:

```
Web Dashboard
├── Claude Code Agent (our implementation)
├── Future Agent 1 (e.g., deployment agent)
├── Future Agent 2 (e.g., monitoring agent)
└── Agent Management UI
```

### **React Integration with Cloudflare Agents**

#### **1. Core Integration Pattern**

```typescript
// apps/web/src/hooks/use-claude-agent.tsx
import { useAgent } from 'cloudflare-agents/react'

export function useClaudeAgent() {
  const agent = useAgent({
    agentId: 'claude-code-agent',
    // WebSocket connection to our ClaudeCodeAgent
    endpoint: '/agent-ws',
  })

  return agent
}
```

#### **2. Chat Interface Components**

```typescript
// apps/web/src/components/claude-chat.tsx
import { useClaudeAgent } from '../hooks/use-claude-agent';
import { useState } from 'react';

export function ClaudeChat() {
  const { messages, sendMessage, isLoading } = useClaudeAgent();
  const [input, setInput] = useState('');

  return (
    <div className="flex flex-col h-full">
      {/* Message History */}
      <div className="flex-1 overflow-y-auto">
        {messages.map((message) => (
          <div key={message.id} className="p-4">
            <div className="font-bold">{message.role}</div>
            {/* Handle different message types */}
            {message.type === 'progress' && <ProgressIndicator {...message} />}
            {message.type === 'result' && <CodeResult {...message} />}
            {message.type === 'file_change' && <FileChangeNotification {...message} />}
            {message.type === 'error' && <ErrorDisplay {...message} />}
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={(e) => {
        e.preventDefault();
        sendMessage(input);
        setInput('');
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          className="w-full p-2 border"
          placeholder="Ask Claude Code..."
        />
      </form>
    </div>
  );
}
```

#### **3. Real-time Streaming Components**

Based on Vercel AI SDK patterns, our UI will support:

```typescript
// Real-time progress indicators
function ProgressIndicator({ content, progress }: ProgressMessage) {
  return (
    <div className="flex items-center space-x-2">
      <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full" />
      <span>{content}</span>
      {progress && <div className="w-32 bg-gray-200 rounded-full h-2">
        <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${progress}%` }} />
      </div>}
    </div>
  );
}

// File change notifications
function FileChangeNotification({ file, action, diff }: FileChangeMessage) {
  return (
    <div className="bg-green-50 border border-green-200 rounded p-3">
      <div className="flex items-center space-x-2">
        <FileIcon />
        <span className="font-medium">{action}</span>
        <code className="text-sm">{file}</code>
      </div>
      {diff && <CodeDiff diff={diff} />}
    </div>
  );
}

// Tool usage display
function ToolUsageDisplay({ tool, args, result }: ToolUseMessage) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded p-3">
      <div className="flex items-center space-x-2">
        <ToolIcon name={tool} />
        <span className="font-medium">Using {tool}</span>
      </div>
      <pre className="text-sm text-gray-600 mt-2">{JSON.stringify(args, null, 2)}</pre>
      {result && <div className="mt-2 text-sm">{result}</div>}
    </div>
  );
}
```

### **4. Agent Management Dashboard**

```typescript
// apps/web/src/components/agent-dashboard.tsx
export function AgentDashboard() {
  const [activeAgent, setActiveAgent] = useState('claude-code');

  return (
    <div className="flex h-screen">
      {/* Agent Sidebar */}
      <div className="w-64 bg-gray-100 p-4">
        <h2 className="font-bold mb-4">Available Agents</h2>
        <AgentList onSelectAgent={setActiveAgent} />
      </div>

      {/* Active Agent Interface */}
      <div className="flex-1">
        {activeAgent === 'claude-code' && <ClaudeChat />}
        {activeAgent === 'deploy-agent' && <DeploymentAgent />}
        {/* Future agents... */}
      </div>
    </div>
  );
}
```

### **WebSocket Communication Flow**

```
Web UI Component
    ↓ User Input
useClaudeAgent Hook
    ↓ WebSocket Message
agent-worker (WebSocket Handler)
    ↓ Message Processing
ClaudeCodeAgent (Durable Object)
    ↓ Container Execution
Claude Code Container
    ↓ CLI Streaming Output
Output Parser
    ↓ Structured Messages
Agent State Update
    ↓ WebSocket Broadcast
Real-time UI Updates
```

### **UI Migration Strategy**

#### **Phase 1: Agent Integration Foundation**

1. Install Cloudflare agents package in `/apps/web`
2. Create agent hooks and basic components
3. Implement WebSocket connection to ClaudeCodeAgent
4. Basic chat interface with message display

#### **Phase 2: Enhanced UI Components**

1. Real-time progress indicators
2. File change notifications
3. Tool usage visualization
4. Code diff displays
5. Error handling UI

#### **Phase 3: Multi-Agent Dashboard**

1. Agent management sidebar
2. Multiple agent support
3. Agent switching capabilities
4. Unified session management across agents

#### **Phase 4: Advanced Features**

1. Session history and management
2. Agent configuration UI
3. Performance monitoring dashboard
4. Advanced streaming visualizations

### **Key Benefits of This Approach**

1. **Future-Proof**: Easy to add new specialized agents
2. **Real-time**: WebSocket streaming with progress indicators
3. **Modern UX**: React hooks integration with Cloudflare agents
4. **Scalable**: Multi-agent architecture supports expansion
5. **Consistent**: Unified UI patterns across different agents

### **Vercel AI SDK Integration Patterns**

Based on the research, our UI will leverage these proven patterns:

#### **Streaming UI Components**

- Use `streamUI` pattern for real-time component updates
- Implement `createStreamableUI` for server-side component streaming
- Support `useStreamableValue` for client-side streaming consumption

#### **Real-time Message Handling**

- Implement `useChat` pattern for conversation management
- Use `readStreamableValue` for processing streamed responses
- Support tool invocation display with confirmation patterns

#### **Agent State Management**

- Use `useUIState` for persistent conversation state
- Implement `useActions` for server-side action invocation
- Support session resumption with `resumeStream` capabilities

## Technical Considerations

### Performance

- **WebSocket Overhead**: Minimal compared to REST polling
- **Memory Usage**: Agent framework state is lightweight
- **Container Lifecycle**: Optimize hibernation/awakening cycles
- **Concurrent Sessions**: Durable Objects provide excellent isolation

### Security

- **Authentication**: Integrate with existing auth system
- **Session Isolation**: Durable Objects provide strong isolation
- **Container Security**: Existing security model preserved
- **API Security**: WebSocket connections require authentication

### Scalability

- **Edge Distribution**: Leverage Cloudflare's global network
- **Auto-scaling**: Durable Objects scale automatically
- **Resource Management**: Container resource limits and monitoring
- **Load Balancing**: Handled by Cloudflare edge routing

### Error Handling

- **Container Failures**: Automatic restart with session recovery
- **Network Issues**: WebSocket reconnection with message buffering
- **Parse Errors**: Graceful handling with fallback formatting
- **Resource Limits**: Proper error messaging and cleanup

## Success Metrics

### User Experience

- **Response Time**: Sub-200ms for WebSocket message delivery
- **Uptime**: >99.9% availability for agent sessions
- **Session Recovery**: <5 second recovery time from container restart
- **Real-time Updates**: <100ms latency for streaming responses

### Technical Metrics

- **Memory Usage**: <50MB per active session
- **CPU Usage**: <10% per active session
- **Container Startup**: <2 seconds for cold start
- **WebSocket Connections**: Support 1000+ concurrent connections

### Business Metrics

- **User Engagement**: Increased session duration
- **Error Reduction**: 50% reduction in user-reported issues
- **Developer Experience**: Faster development cycles with better tooling
- **Operational Efficiency**: Reduced support load through better error handling

## Conclusion

The integration of Claude Code with Cloudflare's Agent Framework represents a significant architectural upgrade that provides enhanced user experience, better session management, and improved scalability while preserving existing container infrastructure investments.

The phased implementation approach ensures minimal disruption to current operations while delivering incremental value throughout the development process. The parallel implementation strategy provides a safe migration path with the ability to rollback if issues arise.

Key success factors include proper state synchronization between agent framework and Claude Code sessions, robust error handling, and comprehensive testing throughout the implementation phases.
