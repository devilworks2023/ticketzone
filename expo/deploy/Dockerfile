# TicketZone - Full Stack Deployment
# Frontend (Expo Web) + Backend (Hono + tRPC + SQLite)

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

RUN apk add --no-cache python3 make g++ curl

COPY deploy/package.deploy.json ./package.json

RUN npm install --legacy-peer-deps

COPY app ./app
COPY assets ./assets
COPY constants ./constants
COPY contexts ./contexts
COPY mocks ./mocks
COPY types ./types
COPY lib ./lib
COPY tsconfig.json ./
COPY app.json ./
COPY babel.config.js ./

RUN echo 'const { getDefaultConfig } = require("expo/metro-config");' > metro.config.js && \
    echo 'const config = getDefaultConfig(__dirname);' >> metro.config.js && \
    echo 'config.resolver.unstable_enablePackageExports = true;' >> metro.config.js && \
    echo 'module.exports = config;' >> metro.config.js

RUN npx expo export -p web

# Stage 2: Build Backend
FROM node:20-alpine AS backend-builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY backend ./backend
COPY types ./types
COPY lib ./lib

COPY deploy/package.backend.json ./package.json

RUN npm install

# Stage 3: Production
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache nginx curl sqlite

COPY --from=frontend-builder /app/dist /usr/share/nginx/html

COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/backend ./backend
COPY --from=backend-builder /app/types ./types
COPY --from=backend-builder /app/lib ./lib
COPY --from=backend-builder /app/package.json ./package.json

COPY deploy/nginx.fullstack.conf /etc/nginx/nginx.conf

RUN mkdir -p /app/data && chmod 755 /app/data

COPY deploy/start.sh /start.sh
RUN chmod +x /start.sh

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/ticketzone.db

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

CMD ["/start.sh"]
