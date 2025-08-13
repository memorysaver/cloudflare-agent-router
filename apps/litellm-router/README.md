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
   # Add to your shell profile or .env file
   export OPENAI_API_KEY="your-openai-key"
   export ANTHROPIC_API_KEY="your-anthropic-key"
   export LITELLM_MASTER_KEY="sk-1234"  # Optional, defaults to sk-1234
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
   # Health check
   curl http://localhost:8787/health
   
   # List available models
   curl http://localhost:8787/v1/models
   
   # Chat completion
   curl -X POST http://localhost:8787/v1/chat/completions \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer sk-1234" \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [{"role": "user", "content": "Hello!"}]
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

```bash
# Run all tests
just test

# Run tests for this worker only
pnpm turbo -F litellm-router test

# Run a specific test file
pnpm vitest src/test/integration/api.test.ts
```

Note: Tests run without the container to avoid Docker dependency in CI. The endpoints return 503 when container is not configured, which is expected behavior in test mode.

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

The router supports models from:
- **OpenAI**: gpt-4, gpt-4-turbo, gpt-3.5-turbo
- **Anthropic**: claude-3-opus, claude-3-sonnet, claude-3-haiku

Models are configured in `litellm_config.yaml`.

### API Endpoints

- `GET /`: Health check
- `GET /health`: Detailed health status
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
