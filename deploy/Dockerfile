# TicketZone Web - Multi-stage build (Sin dependencias de Rork)
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package.json for deployment
COPY deploy/package.deploy.json ./package.json

# Install dependencies with legacy peer deps for compatibility
RUN npm install --legacy-peer-deps

# Copy source code
COPY app ./app
COPY assets ./assets
COPY constants ./constants
COPY contexts ./contexts
COPY mocks ./mocks
COPY types ./types
COPY tsconfig.json ./
COPY app.json ./
COPY babel.config.js ./

# Create metro config
RUN echo 'const { getDefaultConfig } = require("expo/metro-config");' > metro.config.js && \
    echo 'const config = getDefaultConfig(__dirname);' >> metro.config.js && \
    echo 'module.exports = config;' >> metro.config.js

# Build web version
RUN npx expo export -p web

# Production stage with Nginx
FROM nginx:alpine AS production

# Copy nginx config
COPY deploy/nginx.conf /etc/nginx/nginx.conf

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
