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

# Install Claude CLI globally and other dependencies
RUN npm install -g @anthropic-ai/claude-code && \
    npm install --verbose hono @hono/node-server

# Verify Claude CLI installation
RUN claude --version

# Create ~/.claude directory for Claude Code SDK session storage
RUN mkdir -p ~/.claude/projects && \
    chmod 755 ~/.claude && \
    chmod 755 ~/.claude/projects

# Create the HTTP server that uses Claude CLI wrapper
COPY claude-server.js ./claude-server.js
COPY claude-cli-wrapper.js ./claude-cli-wrapper.js
COPY debug-server.js ./debug-server.js
COPY simple-server.js ./simple-server.js

# Expose port 3000 for communication
EXPOSE 3000

# Start the Claude Code SDK server
CMD ["node", "claude-server.js"]