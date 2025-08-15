# Simplified LiteLLM Router v0.2

A streamlined Cloudflare Worker that provides intelligent API routing for multiple LLM providers with automatic provider detection and dual API format support.

## Overview

This simplified router eliminates complex authentication modes in favor of an intuitive approach:

**🎯 "Bring your API key OR we auto-detect the provider"**

- Supports both **OpenAI** (`/v1/chat/completions`) and **Anthropic** (`/v1/messages`) API formats
- Automatically detects provider from model name using regex patterns
- Uses internal API keys when no user key is provided
- **55% code reduction** from v1.0 (159 → 72 lines in main router)
- Modular architecture with clean separation of concerns

## Key Features

✅ **Intelligent Auto-Detection**: Analyzes model names to determine provider automatically  
✅ **Dual API Support**: Works with both OpenAI and Anthropic API formats seamlessly  
✅ **BYOK (Bring Your Own Key)**: Pass your own API keys for direct provider access  
✅ **Modular Architecture**: Clean `utils/` and `handlers/` separation for maintainability  
✅ **Better Error Messages**: Clear, actionable error responses with provider suggestions  
✅ **Claude Code Ready**: Proven integration with Claude Code AI assistant

## Quick Start

1. **Start the router**: `just dev` (starts on port 8787)
2. **Test auto-detection**:
   ```bash
   ./test-router.sh  # Tests all router functionality
   ```
3. **Test Claude Code integration**:
   ```bash
   ./test-cc.sh    # Launches Claude Code through router
   ```

## Authentication & Auto-Detection

The router supports two simple authentication modes:

### Option 1: Auto-Detection Mode

Use the special `auto-detect` token to trigger provider detection:

```bash
curl -X POST http://localhost:8787/v1/chat/completions \
  -H "Authorization: Bearer auto-detect" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openrouter/qwen/qwen3-coder",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 50
  }'
```

**How it works:**

1. Router detects `openrouter/` prefix in model name
2. Uses internal `OPENROUTER_API_KEY` environment variable
3. Forwards request to LiteLLM with proper authentication

### Option 2: BYOK Mode

Provide your own API key for direct provider access:

```bash
curl -X POST http://localhost:8787/v1/chat/completions \
  -H "Authorization: Bearer your-actual-openrouter-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openrouter/qwen/qwen3-coder",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 50
  }'
```

> ⚠️ **Important**: The `auto-detect` token is a special reserved value that triggers provider detection. Any other token is treated as a real API key and passed directly to the provider.

## Provider Auto-Detection

The router uses regex patterns to identify providers from model names:

| Provider       | Pattern           | Example Models                |
| -------------- | ----------------- | ----------------------------- | --------------------------------------------- | ----------------------------------- | ----------------------------- |
| **OpenRouter** | `/^openrouter\//` | `openrouter/qwen/qwen3-coder` |
| **Anthropic**  | `/^(anthropic\/   | claude-)/`                    | `anthropic/claude-3-haiku`, `claude-3-sonnet` |
| **Groq**       | `/^(groq\/        | llama                         | mixtral)/`                                    | `groq/llama3-8b-8192`, `llama3-70b` |
| **Cerebras**   | `/^cerebras\//`   | `cerebras/llama3.1-8b`        |
| **OpenAI**     | `/^(openai\/      | gpt-                          | text-                                         | davinci)/`                          | `openai/gpt-4`, `gpt-4o-mini` |

**Detection Priority**: First match wins (order matters)

**Environment Variables Required**:

- `OPENROUTER_API_KEY` - For OpenRouter models
- `ANTHROPIC_API_KEY` - For Anthropic/Claude models
- `GROQ_API_KEY` - For Groq models
- `CEREBRAS_API_KEY` - For Cerebras models
- `OPENAI_API_KEY` - For OpenAI models (optional, use OpenRouter instead)

## API Endpoints

### Health & Status

- **`GET /worker-health`** - Simplified health check with provider status

```bash
curl http://localhost:8787/worker-health
```

**Response**:

```json
{
  "status": "healthy",
  "service": "LiteLLM Router",
  "version": "0.2.0",
  "description": "Simplified router: Bring your API key or we auto-detect provider",
  "available_providers": ["openrouter", "anthropic", "groq", "cerebras", "openai"],
  "internal_keys": {
    "total_configured": 5
  }
}
```

### Completion Endpoints

Both OpenAI and Anthropic API formats are supported:

- **`POST /v1/chat/completions`** - OpenAI format (streaming supported)
- **`POST /v1/messages`** - Anthropic format (streaming supported)
- **`POST /v1/completions`** - Legacy OpenAI completions
- **`GET /v1/models`** - List available models

## Examples

### Auto-Detection Examples

**OpenAI Format**:

```bash
curl -X POST http://localhost:8787/v1/chat/completions \
  -H "Authorization: Bearer auto-detect" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "groq/llama3-8b-8192",
    "messages": [{"role": "user", "content": "What is 2+2?"}],
    "max_tokens": 10
  }'
```

**Anthropic Format**:

```bash
curl -X POST http://localhost:8787/v1/messages \
  -H "Authorization: Bearer auto-detect" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic/claude-3-haiku-20240307",
    "messages": [{"role": "user", "content": "What is 2+2?"}],
    "max_tokens": 10
  }'
```

### BYOK Examples

**With Your Own Groq Key**:

```bash
curl -X POST http://localhost:8787/v1/chat/completions \
  -H "Authorization: Bearer gsk-your-groq-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "groq/llama3-8b-8192",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 20
  }'
```

**With Your Own Anthropic Key**:

```bash
curl -X POST http://localhost:8787/v1/messages \
  -H "Authorization: Bearer sk-ant-your-anthropic-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic/claude-3-haiku-20240307",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 20
  }'
```

### List Available Models

```bash
curl -X GET http://localhost:8787/v1/models \
  -H "Authorization: Bearer auto-detect"
```

## Claude Code Integration

The router works seamlessly with Claude Code AI assistant:

### Environment Setup

```bash
export ANTHROPIC_AUTH_TOKEN="auto-detect"
export ANTHROPIC_BASE_URL="http://localhost:8787"
export ANTHROPIC_MODEL="openrouter/qwen/qwen3-coder"
export ANTHROPIC_SMALL_FAST_MODEL="openrouter/qwen/qwen3-coder"
```

### Quick Test Script

Use the provided `test-cc.sh` script:

```bash
./test-cc.sh
```

**What it does**:

1. Checks if router is healthy on port 8787
2. Sets up environment variables for Claude Code
3. Launches Claude Code with the command: `claude -p "tell me a joke" --output-format stream-json --verbose`

**Example Output**:

```
🔍 Checking router health on port 8787...
✅ Router is healthy!
🚀 Launching Claude Code with local router...
📡 Using model: openrouter/qwen/qwen3-coder
🌐 Router URL: http://localhost:8787

{"type":"assistant","message":{"content":[{"type":"text","text":"Why don't scientists trust atoms?\n\nBecause they make up everything!"}]}}
```

## Local Development

### Prerequisites

1. **Docker Desktop**: Must be installed and running locally
2. **Environment Variables**: Set up your API keys in `.dev.vars`

```bash
# Copy and edit environment file
cp .env.example .dev.vars
# Add your API keys for providers you want to use
```

### Development Workflow

1. **Install Dependencies**:

   ```bash
   just install
   ```

2. **Start Local Development**:

   ```bash
   just dev  # Starts on port 8787
   ```

3. **Test the Router**:

   ```bash
   # Test all functionality
   ./test-router.sh

   # Test Claude Code integration
   ./test-cc.sh
   ```

### What Happens During `just dev`

- Wrangler builds the Docker image from `./Dockerfile`
- Starts the LiteLLM container locally using Docker
- Creates a local development server on port 8787
- Router handles authentication and forwards to LiteLLM container

## Testing

### Clean Testing Separation

We use a clean separation between **fast unit tests** (CI/CD ready) and **integration tests** (manual, requires server):

#### Fast Unit Tests (CI/CD Ready)

```bash
# Run all unit tests - NO dependencies required
just test

# Run tests for this worker only
pnpm turbo -F litellm-router test
```

**What's tested:**

- ✅ Provider detection regex patterns
- ✅ Auth token extraction logic
- ✅ Request modification utilities
- ✅ API routing (mocked with SELF.fetch)
- ✅ Type validation and error handling

**Benefits:**

- 🚀 **Fast execution** (~2-3 seconds)
- 🤖 **CI/CD ready** (no external dependencies)
- 🔄 **Developer friendly** (instant feedback during development)

#### Integration Test Scripts (Manual - Requires `just dev`)

**⚠️ All scripts require running `just dev` first to start local server on port 8787**

**`./test-router.sh`** - Router functionality testing:

- Router logic and behavior validation
- Auto-detect vs BYOK token routing
- Dual API format support (OpenAI + Anthropic)
- Error handling and validation
- **Requirements**: Only `just dev` running
- **Purpose**: Test router logic (no real API calls)
- **Usage**: Development and router validation

**`./test-providers.sh`** - Real LLM provider testing:

- Actual LLM API calls with configured keys
- Provider authentication validation
- Model listing and availability verification
- End-to-end provider integration testing
- **Requirements**: `just dev` + API keys in `.dev.vars`
- **Purpose**: Validate real provider integration
- **Usage**: Production readiness testing

**`./test-cc.sh`** - Claude Code integration:

- Router health verification for Claude Code
- Environment variable setup validation
- Claude Code launch with streaming output
- **Usage**: Test Claude Code AI assistant integration

### Quick Test Commands

**Development Workflow:**

```bash
# 1. Fast feedback during development
just test

# 2. Start server for integration testing
just dev

# 3. Test router logic and behavior (in another terminal)
./test-router.sh                   # No API keys needed

# 4. Test real provider integration (optional)
./test-providers.sh                # Needs API keys in .dev.vars

# 5. Test Claude Code integration
./test-cc.sh                       # Uses auto-detect mode
```

**When to Use Which Script:**

- **`just test`**: During development (instant feedback)
- **`./test-router.sh`**: Router changes (test logic without API costs)
- **`./test-providers.sh`**: Before deployment (validate providers work)
- **`./test-cc.sh`**: AI assistant integration validation

### Manual Testing Examples

**Health Check**:

```bash
curl http://localhost:8787/worker-health | jq '.'
```

**Auto-Detection Test**:

```bash
curl -X POST http://localhost:8787/v1/chat/completions \
  -H "Authorization: Bearer auto-detect" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "groq/llama3-8b-8192",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 20
  }' | jq '.'
```

**Anthropic Format Test**:

```bash
curl -X POST http://localhost:8787/v1/messages \
  -H "Authorization: Bearer auto-detect" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic/claude-3-haiku-20240307",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 20
  }' | jq '.'
```

## Architecture

### Simplified Design (v0.2)

```
Client Request → Worker (8787) → LiteLLM Container (4000) → Provider APIs
                    ↓
                [Auth Logic]
                    ↓
            auto-detect → Provider Detection → Internal Key
            real-key → Pass Through → User Key
```

### Modular File Structure

```
src/
├── index.ts              # Main router (72 lines, 55% reduction)
├── utils/
│   ├── auth.ts           # Token extraction
│   ├── provider.ts       # Provider detection & patterns
│   ├── request.ts        # Request modification
│   └── types.ts          # Shared interfaces
├── handlers/
│   ├── completion.ts     # Completion endpoint logic
│   └── proxy.ts          # Non-completion requests
└── container.ts          # LiteLLM container (unchanged)
```

**Benefits of Modular Design**:

- ✅ **Testable**: Each utility function can be tested independently
- ✅ **Maintainable**: Clear separation of concerns
- ✅ **Extensible**: Easy to add new providers or modify logic
- ✅ **Debuggable**: Issues can be isolated to specific modules

### Request Flow

1. **Request arrives** at Worker on port 8787
2. **Endpoint detection**: `/v1/messages` or `/v1/chat/completions` → completion handler
3. **Auth extraction**: Parse `Authorization: Bearer <token>` header
4. **Auth decision**:
   - If `token === "auto-detect"` → Provider detection mode
   - If `token !== "auto-detect"` → BYOK mode (pass through)
5. **Provider detection** (auto-detect mode only):
   - Parse model name with regex patterns
   - Get internal API key for detected provider
6. **Request modification**: Inject chosen API key into request body
7. **Forward to container**: Send modified request to LiteLLM
8. **Return response**: Stream back to client

## Configuration

### Environment Variables

**Required for Auto-Detection**:

- `OPENROUTER_API_KEY` - Recommended (100+ models via single key)
- `ANTHROPIC_API_KEY` - For Claude models
- `GROQ_API_KEY` - For fast inference models
- `CEREBRAS_API_KEY` - For high-performance models
- `OPENAI_API_KEY` - Optional (can use OpenRouter instead)

**Container Configuration**:

- `LITELLM_MASTER_KEY` - For non-completion endpoints (health, models)

### Supported Providers & Models

| Provider       | Models Available      | Auto-Detection                          |
| -------------- | --------------------- | --------------------------------------- |
| **OpenRouter** | 100+ models           | ✅ `openrouter/` prefix                 |
| **Anthropic**  | Claude 3.5, Claude 3  | ✅ `anthropic/` or `claude-` prefix     |
| **Groq**       | Llama, Mixtral, Gemma | ✅ `groq/`, `llama`, `mixtral` patterns |
| **Cerebras**   | Llama optimized       | ✅ `cerebras/` prefix                   |
| **OpenAI**     | GPT models            | ✅ `openai/`, `gpt-`, `text-` patterns  |

**Model Examples**:

- `openrouter/qwen/qwen3-coder` - Qwen3 Coder via OpenRouter
- `anthropic/claude-3-haiku-20240307` - Claude 3 Haiku
- `groq/llama3-8b-8192` - Llama 3 8B via Groq
- `cerebras/llama3.1-8b` - Llama 3.1 8B via Cerebras
- `gpt-4o-mini` - GPT-4o Mini via OpenAI

## Deployment

```bash
# Deploy to Cloudflare
just deploy

# Deploy this worker only
pnpm turbo -F litellm-router deploy
```

**Before deployment, ensure**:

- `CLOUDFLARE_API_TOKEN` is set
- `CLOUDFLARE_ACCOUNT_ID` is set
- API keys are configured in Cloudflare dashboard (not in wrangler.jsonc)

## Troubleshooting

### Common Issues

**"Router not running on port 8787"**:

- Ensure `just dev` is running
- Check for port conflicts: `lsof -i :8787`
- Try restarting: Stop dev server and run `just dev` again

**"Invalid API Key" errors with auto-detect**:

- Verify environment variables are set: `echo $OPENROUTER_API_KEY`
- Check provider detection: Model name must match regex patterns
- Test with health check: `curl http://localhost:8787/worker-health`

**"auto-detect" token not working**:

- ✅ **Correct**: `Authorization: Bearer auto-detect`
- ❌ **Incorrect**: `Authorization: Bearer "auto-detect"` (extra quotes)
- ❌ **Incorrect**: `Authorization: auto-detect` (missing Bearer)

**Claude Code not connecting**:

- Verify environment variables:
  ```bash
  echo $ANTHROPIC_BASE_URL  # Should be http://localhost:8787
  echo $ANTHROPIC_AUTH_TOKEN  # Should be auto-detect
  ```
- Test router directly first: `./test-router.sh`
- Check if port 8787 is accessible: `curl http://localhost:8787/worker-health`

**Container not starting**:

- Ensure Docker Desktop is running: `docker info`
- Check Docker daemon status and available memory
- Verify container logs in Docker Desktop interface

**Provider not detected**:

- Check model name against patterns in Provider Auto-Detection section
- Test specific provider: `curl -X POST ... -d '{"model": "groq/llama3-8b-8192", ...}'`
- Verify API key for detected provider is configured

### Error Messages

**Good Error Messages (v0.2)**:

```json
{
  "error": "No API key available",
  "message": "Provide Authorization header or use a supported model",
  "details": "Available providers: openrouter, anthropic, groq",
  "code": "NO_API_KEY"
}
```

**Provider-Specific Errors**:

```json
{
  "error": "No API key available",
  "message": "No internal API key configured for detected provider: groq",
  "details": "Available providers: openrouter, anthropic",
  "code": "NO_API_KEY"
}
```

### Performance Notes

- **Auto-detection overhead**: ~1ms for regex pattern matching
- **Container warmup**: First request may take 2-3 seconds
- **Subsequent requests**: Sub-200ms response times
- **Provider detection**: Cached after first successful match

---

## Migration from v1.0

**Key Changes**:

- ❌ **Removed**: Complex premium/BYOK authentication modes
- ❌ **Removed**: Master key authentication for completions
- ✅ **Added**: Simple auto-detect token for provider detection
- ✅ **Added**: Anthropic `/v1/messages` endpoint support
- ✅ **Added**: Modular architecture with utils/handlers
- ✅ **Improved**: Error messages with actionable details

**Breaking Changes**:

- Master key `sk-1234` no longer works for completions
- Must use `auto-detect` token or real provider API keys
- Health endpoint moved from `/health` to `/worker-health`

**Migration Steps**:

1. Replace `Authorization: Bearer sk-1234` with `Authorization: Bearer auto-detect`
2. Update health check endpoint to `/worker-health`
3. Set up internal API keys as environment variables
4. Test with `./test-router.sh` script
