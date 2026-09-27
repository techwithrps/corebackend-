# ==============================================================================
# SPJ Cargo Intelligence Backend - Dockerfile
# Combines Node.js 20 runtime with OpenJDK 17 for Oracle JDBC execution
# ==============================================================================

FROM node:20-bookworm-slim

# Install OpenJDK headless & certificates
RUN apt-get update && \
    apt-get install -y --no-install-recommends openjdk-17-jdk-headless ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install npm dependencies first for Docker caching
COPY package*.json ./
RUN npm ci --only=production

# Copy all backend source files (including Java source and ojdbc11.jar)
COPY . .

# Compile Java Analytics & Warehouse Exporter engines with Oracle JDBC driver
RUN npm run build

# Default environment variables
ENV PORT=5001
ENV NODE_ENV=production

# Expose server port
EXPOSE 5001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 5001) + '/', (r) => { if (r.statusCode !== 200) process.exit(1); })"

# Start the Node.js Express server
CMD ["npm", "start"]
