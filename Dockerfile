# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript and Vite frontend
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./

RUN npm ci --only=production

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy server directory
COPY server ./server

# Copy public assets
COPY public ./public

# Expose the runtime server port
EXPOSE 3001

# Health check (optional)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "const p = process.env.PORT || 3001; require('http').get(`http://localhost:${p}`, (r) => { if (r.statusCode !== 200) throw new Error(r.statusCode) })"

# Start the web + websocket server
CMD ["node", "server/ws-server.js"]
