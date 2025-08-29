# Use Node.js slim base image for Claude Code SDK
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for Claude Code execution
RUN groupadd --gid 1001 claudeuser && \
    useradd --uid 1001 --gid claudeuser --shell /bin/bash --create-home claudeuser

# Install Claude CLI globally as root
RUN npm install -g @anthropic-ai/claude-code && \
    which claude && \
    ls -la /usr/local/bin/claude

# Initialize package.json and install local dependencies
WORKDIR /app
RUN npm init -y && \
    npm install hono @hono/node-server

# Verify Claude CLI installation
RUN claude --version

# Change ownership of /app to claudeuser
RUN chown -R claudeuser:claudeuser /app

# Switch to the non-root user
USER claudeuser

# Set up environment variables to include global npm binaries in PATH
ENV PATH="/usr/local/lib/node_modules/.bin:/usr/local/bin:$PATH"

# Create ~/.claude directory for Claude Code SDK session storage as claudeuser
RUN mkdir -p ~/.claude/projects && \
    chmod 755 ~/.claude && \
    chmod 755 ~/.claude/projects

# Create workspace directory with proper permissions
RUN mkdir -p /home/claudeuser/workspace && \
    chmod 755 /home/claudeuser/workspace

# Verify Claude CLI is accessible as the non-root user
RUN claude --version

# Create the HTTP server that uses Claude CLI wrapper
COPY claude-server.js ./claude-server.js
COPY claude-cli-wrapper.js ./claude-cli-wrapper.js
COPY debug-server.js ./debug-server.js
COPY simple-server.js ./simple-server.js

# Expose port 3000 for communication
EXPOSE 3000

# Start the Claude Code SDK server
CMD ["node", "claude-server.js"]