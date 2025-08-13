# Use the official litellm/litellm image as base if it exists and is smaller
# Otherwise fall back to our optimized approach
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy LiteLLM configuration first
COPY litellm_config.yaml ./config.yaml

# Install LiteLLM with minimal dependencies
RUN pip install --no-cache-dir litellm[proxy]==1.75.5.post1 \
    # Verify litellm command exists
    && python -c "import litellm; print('LiteLLM installed successfully')" \
    # Clean up
    && rm -rf /root/.cache/pip \
    && find /usr/local -name '*.pyc' -delete

# Expose port
EXPOSE 4000

# Run LiteLLM with production settings
CMD ["litellm", "--config", "/app/config.yaml", "--port", "4000", "--host", "0.0.0.0"]