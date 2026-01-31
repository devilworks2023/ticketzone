# TicketZone Web - Multi-stage build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
RUN npm install -g expo-cli

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build web version
RUN npx expo export -p web

# Production stage with Nginx
FROM nginx:alpine AS production

# Copy nginx configuration from builder stage
COPY --from=builder /app/deploy/nginx.conf /etc/nginx/nginx.conf

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
