# MusicLab AI — build único: exporta el frontend Expo Web y lo sirve desde el
# mismo proceso Hono que expone la API (/api/trpc). Un solo servicio, un solo
# puerto — pensado para Railway/Render (o cualquier host con Docker + disco
# persistente para la base de datos SQLite).

FROM node:20-alpine AS builder

WORKDIR /app

# python3/make/g++ son necesarios para compilar el binding nativo de better-sqlite3.
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .

RUN npx expo export -p web


FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache curl

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/dist ./web-build
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/types ./types

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/musiclab.db
# Relativo a WORKDIR (/app): @hono/node-server's serveStatic no admite rutas absolutas.
ENV WEB_BUILD_DIR=web-build

# Railway/Render inyectan PORT en tiempo de ejecución; backend/server.ts ya lo respeta.
EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3002}/health || exit 1

CMD ["npx", "tsx", "backend/server.ts"]
