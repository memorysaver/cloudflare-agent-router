# Use Node.js slim base image for Claude Code SDK
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Initialize package.json and install dependencies
RUN npm init -y

# Install Claude Code SDK and Hono with verbose logging
RUN npm install --verbose @anthropic-ai/claude-code hono @hono/node-server

# Create the HTTP server that uses Claude Code SDK
COPY claude-server.js ./claude-server.js
COPY debug-server.js ./debug-server.js
COPY simple-server.js ./simple-server.js

# Expose port 3000 for communication
EXPOSE 3000

# Start the Claude Code SDK server
CMD ["node", "claude-server.js"]