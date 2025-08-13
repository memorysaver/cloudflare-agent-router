# Build minimal LiteLLM container under 2GB
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies efficiently
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Install LiteLLM
RUN pip install --no-cache-dir litellm

# Copy LiteLLM configuration
COPY litellm_config.yaml ./config.yaml

# Expose the port LiteLLM runs on
EXPOSE 4000

# Run LiteLLM proxy with configuration
CMD ["litellm", "--config", "/app/config.yaml", "--port", "4000", "--detailed_debug"]