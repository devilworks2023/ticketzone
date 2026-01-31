# TicketZone Web - Multi-stage build
FROM node:20-alpine AS builder

WORKDIR /app

# Enable package exports for zod/v4 resolution (set early)
ENV EXPO_USE_METRO_UNSTABLE_ENABLE_PACKAGE_EXPORTS=true

# Install dependencies
RUN npm install -g expo-cli

# Copy package files
COPY package.json bun.lock ./

# Install dependencies (--legacy-peer-deps for React 19 compatibility)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Create metro config for zod/v4 resolution
RUN echo 'const { getDefaultConfig } = require("expo/metro-config");' > metro.config.js && \
    echo 'const config = getDefaultConfig(__dirname);' >> metro.config.js && \
    echo 'config.resolver.unstable_enablePackageExports = true;' >> metro.config.js && \
    echo 'module.exports = config;' >> metro.config.js

# Build web version
RUN npx expo export -p web

# Production stage with Nginx
FROM nginx:alpine AS production

# Create nginx configuration inline
RUN echo 'worker_processes auto;' > /etc/nginx/nginx.conf && \
    echo 'error_log /var/log/nginx/error.log warn;' >> /etc/nginx/nginx.conf && \
    echo 'pid /var/run/nginx.pid;' >> /etc/nginx/nginx.conf && \
    echo 'events { worker_connections 1024; }' >> /etc/nginx/nginx.conf && \
    echo 'http {' >> /etc/nginx/nginx.conf && \
    echo '    include /etc/nginx/mime.types;' >> /etc/nginx/nginx.conf && \
    echo '    default_type application/octet-stream;' >> /etc/nginx/nginx.conf && \
    echo '    sendfile on;' >> /etc/nginx/nginx.conf && \
    echo '    keepalive_timeout 65;' >> /etc/nginx/nginx.conf && \
    echo '    gzip on;' >> /etc/nginx/nginx.conf && \
    echo '    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;' >> /etc/nginx/nginx.conf && \
    echo '    server {' >> /etc/nginx/nginx.conf && \
    echo '        listen 80;' >> /etc/nginx/nginx.conf && \
    echo '        server_name localhost;' >> /etc/nginx/nginx.conf && \
    echo '        root /usr/share/nginx/html;' >> /etc/nginx/nginx.conf && \
    echo '        index index.html;' >> /etc/nginx/nginx.conf && \
    echo '        location / {' >> /etc/nginx/nginx.conf && \
    echo '            try_files $uri $uri/ /index.html;' >> /etc/nginx/nginx.conf && \
    echo '        }' >> /etc/nginx/nginx.conf && \
    echo '        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {' >> /etc/nginx/nginx.conf && \
    echo '            expires 1y;' >> /etc/nginx/nginx.conf && \
    echo '            add_header Cache-Control "public, immutable";' >> /etc/nginx/nginx.conf && \
    echo '        }' >> /etc/nginx/nginx.conf && \
    echo '    }' >> /etc/nginx/nginx.conf && \
    echo '}' >> /etc/nginx/nginx.conf

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
