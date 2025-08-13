# Use the official LiteLLM image as base
FROM ghcr.io/berriai/litellm:main-stable

# Set working directory
WORKDIR /app

# Copy LiteLLM configuration
COPY litellm_config.yaml ./config.yaml

# Expose the port LiteLLM runs on
EXPOSE 4000

# Run LiteLLM proxy with configuration
CMD ["--config", "/app/config.yaml", "--port", "4000", "--detailed_debug"]