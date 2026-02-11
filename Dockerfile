# Build stage
FROM node:20-alpine@sha256:2ffec31a58e85fbcd575c544a3584f6f4d128779e6b856153a04366b8dd01bb0 AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy project files
COPY . .

# Build the app
RUN npm run build

# Production stage - using node with serve instead of nginx
FROM node:20-alpine@sha256:2ffec31a58e85fbcd575c544a3584f6f4d128779e6b856153a04366b8dd01bb0

WORKDIR /app

# Install serve to run the application
RUN npm install -g serve

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Copy public assets
COPY --from=builder /app/public ./dist

# Run as non-root user
RUN adduser -D -H -u 1001 appuser
USER appuser

# Add a healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

EXPOSE 3000

# Run the app using serve
CMD ["serve", "-s", "dist", "-l", "3000"]