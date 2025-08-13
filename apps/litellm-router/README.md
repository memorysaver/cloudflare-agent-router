# LiteLLM Router

A Cloudflare Worker that provides a unified OpenAI-compatible API gateway for multiple LLM providers using LiteLLM running in a Cloudflare Container.

## Overview

This service acts as a proxy router that:

- Provides OpenAI-compatible endpoints (`/v1/chat/completions`, `/v1/models`, etc.)
- Routes requests to multiple LLM providers (OpenAI, Anthropic, etc.)
- Runs LiteLLM in a Cloudflare Container for Python-based routing logic
- Supports load balancing, retries, and failover between providers

## Architecture

```
Client Request → Cloudflare Worker → LiteLLM Container → LLM Provider APIs
```

- **Cloudflare Worker**: Handles HTTP routing and authentication
- **LiteLLM Container**: Python-based LLM proxy with multi-provider support
- **Durable Objects**: Manages container lifecycle and state

## Local Development

### Prerequisites

1. **Docker Desktop**: Must be installed and running locally
   - Download from [docker.com](https://www.docker.com/products/docker-desktop/)
   - Ensure Docker daemon is running before starting development

2. **Environment Variables**: Set up your API keys

   ```bash
   # Copy the example environment file
   cp .env.example .env

   # Edit .env file with your API keys
   # Get API keys from:
   # - Anthropic: https://console.anthropic.com/
   # - OpenRouter: https://openrouter.ai/keys (Recommended - 100+ models)
   # - Groq: https://console.groq.com/keys
   # - Cerebras: https://cloud.cerebras.ai/
   # - OpenAI: https://platform.openai.com/api-keys
   ```

### Development Workflow

1. **Install Dependencies**

   ```bash
   # From the monorepo root
   just install
   ```

2. **Start Local Development**

   ```bash
   # From the monorepo root
   just dev

   # Or run this specific worker only
   pnpm turbo -F litellm-router dev

   # Alternative: Run wrangler directly (if turbo has issues)
   cd apps/litellm-router && pnpm wrangler dev
   ```

3. **What Happens During `wrangler dev`**
   - Wrangler builds the Docker image from `./Dockerfile`
   - Starts the LiteLLM container locally using Docker
   - Creates a local development server at `http://localhost:8787`
   - Container is accessible at internal port 4000

4. **Testing Locally**

   ```bash
   # Basic health check
   curl http://localhost:8787/health

   # LiteLLM health checks
   curl http://localhost:8787/health/litellm      # Comprehensive LLM model health
   curl http://localhost:8787/health/readiness    # Proxy readiness check
   curl http://localhost:8787/health/liveliness   # Basic alive check

   # List available models (requires API keys)
   curl http://localhost:8787/v1/models

   # Test with different providers (examples)
   # Anthropic Claude
   curl -X POST http://localhost:8787/v1/chat/completions \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer sk-1234" \
     -d '{
       "model": "anthropic/claude-3-haiku-20240307",
       "messages": [{"role": "user", "content": "Hello!"}],
       "max_tokens": 100
     }'

   # OpenRouter (100+ models)
   curl -X POST http://localhost:8787/v1/chat/completions \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer sk-1234" \
     -d '{
       "model": "openrouter/anthropic/claude-3-haiku",
       "messages": [{"role": "user", "content": "Hello!"}],
       "max_tokens": 100
     }'

   # Groq (fast inference)
   curl -X POST http://localhost:8787/v1/chat/completions \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer sk-1234" \
     -d '{
       "model": "groq/llama-3.1-8b-instant",
       "messages": [{"role": "user", "content": "Hello!"}],
       "max_tokens": 100
     }'
   ```

### Container Configuration

The LiteLLM container is configured via:

- `Dockerfile`: Uses official LiteLLM image
- `litellm_config.yaml`: Defines available models and routing rules
- `wrangler.jsonc`: Container and Durable Object bindings

### Troubleshooting

**"Build ID should be set if containers are defined" error:**

- This happens when using Vite development mode with containers
- **Solution**: The package.json has been updated to use `wrangler dev` instead of `vite dev`
- **Alternative**: Run `cd apps/litellm-router && pnpm wrangler dev` directly

**Container not starting:**

- Ensure Docker Desktop is running
- Check Docker daemon status: `docker info`
- Verify container logs in Docker Desktop

**API key errors:**

- Ensure environment variables are set in your shell
- Check `wrangler.jsonc` vars section for default values

**Port conflicts:**

- LiteLLM container uses internal port 4000
- Worker dev server typically uses port 8787
- Change ports if needed in `wrangler dev --port <port>`

## Testing

### Unit & Integration Tests

```bash
# Run all tests (without container)
just test

# Run tests for this worker only
pnpm turbo -F litellm-router test

# Run a specific test file
pnpm vitest src/test/integration/api.test.ts
```

### Real LLM API Tests

For testing with actual LLM providers:

```bash
# 1. Set up environment
cp .env.example .env
# Edit .env with your API keys

# 2. Start container
pnpm wrangler dev

# 3. Run real LLM tests
pnpm vitest src/test/integration/real-llm.test.ts
```

**Test Types:**

- **Basic Tests**: Worker routing without container (CI/CD safe)
- **Container Tests**: Health checks with container running
- **Real LLM Tests**: Actual API calls to validate configuration

**What Real LLM Tests Validate:**

- ✅ API keys are working
- ✅ Model configurations are correct
- ✅ Provider routing works
- ✅ LiteLLM proxy functionality
- ✅ Wildcard model patterns

Note: Basic tests run without the container to avoid Docker dependency in CI. Real LLM tests require container + API keys.

## Deployment

```bash
# Deploy to Cloudflare
just deploy

# Deploy this worker only
pnpm turbo -F litellm-router deploy
```

Before deployment, ensure:

- `CLOUDFLARE_API_TOKEN` is set
- `CLOUDFLARE_ACCOUNT_ID` is set
- API keys are configured in Cloudflare dashboard

## Configuration

### Supported Models

The router supports models from multiple providers using wildcard patterns:

- **Anthropic**: `anthropic/*` (All Claude models: opus, sonnet, haiku, etc.)
- **OpenRouter**: `openrouter/*` (100+ models via single API key)
- **Groq**: `groq/*` (Fast inference: Llama, Mixtral, etc.)
- **Cerebras**: `cerebras/*` (High-performance inference)
- **OpenAI**: `openai/*` (GPT models - optional, can use OpenRouter)

**Configuration Features:**

- Wildcard model patterns for easy model access
- Consistent parameters across providers (max_tokens: 65536, temperature: 0.7)
- Environment variable-based API key management
- Load balancing and retry policies

Models are configured in `litellm_config.yaml` based on your dotfiles configuration.

### API Endpoints

**Health & Status:**

- `GET /`: Basic health check
- `GET /health`: Worker health status
- `GET /health/litellm`: Comprehensive LLM model health check
- `GET /health/readiness`: LiteLLM proxy readiness check
- `GET /health/liveliness`: LiteLLM basic alive check

**OpenAI-Compatible API:**

- `GET /v1/models`: List available models
- `POST /v1/chat/completions`: Chat completions (streaming supported)
- `POST /v1/completions`: Legacy completions
- `POST /v1/embeddings`: Text embeddings

### Authentication

Use the `Authorization: Bearer <token>` header. Default master key is `sk-1234` (configurable via `LITELLM_MASTER_KEY`).

## Development Notes

- Container instances are managed by Durable Objects for persistence
- LiteLLM handles provider-specific API differences automatically
- Load balancing and retries are configured in `litellm_config.yaml`
- Detailed logging is enabled for debugging purposes
