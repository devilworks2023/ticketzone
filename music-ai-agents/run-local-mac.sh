#!/usr/bin/env bash
#
# MusicLab AI — instalación y arranque TODO EN LOCAL en un Mac.
#
# Levanta los dos servicios (web + transcripción MT3) con Docker, sin depender de
# ningún servidor en la nube. Usa Colima como runtime de Docker (se instala por
# línea de comandos con Homebrew; no necesita Docker Desktop).
#
# Uso:
#   chmod +x run-local-mac.sh
#   ./run-local-mac.sh            # instala lo necesario, construye y arranca
#   ./run-local-mac.sh stop       # para los servicios
#   ./run-local-mac.sh logs       # ver logs en vivo
#
# La primera vez tarda bastante (construye la imagen de MT3: tensorflow/jax +
# checkpoint de ~172 MB). Ten paciencia.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Recursos de la VM de Colima. MT3 (tensorflow+jax) necesita memoria; deja margen.
COLIMA_CPU="${COLIMA_CPU:-4}"
COLIMA_MEMORY="${COLIMA_MEMORY:-6}"   # GB
COLIMA_DISK="${COLIMA_DISK:-25}"      # GB

log()  { printf "\033[1;35m[musiclab]\033[0m %s\n" "$*"; }
err()  { printf "\033[1;31m[error]\033[0m %s\n" "$*" >&2; }

# Homebrew instala `docker-compose` (con guion) pero no siempre enlaza el plugin
# para `docker compose` (con espacio). Usamos el que esté disponible.
dc() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}

cmd_stop() { log "Parando servicios..."; dc down; }
cmd_logs() { dc logs -f; }

case "${1:-up}" in
  stop) cmd_stop; exit 0 ;;
  logs) cmd_logs; exit 0 ;;
  up) ;;
  *) err "Comando desconocido: $1 (usa: up | stop | logs)"; exit 1 ;;
esac

# 1) Homebrew
if ! command -v brew >/dev/null 2>&1; then
  err "No se encontró Homebrew. Instálalo desde https://brew.sh y vuelve a ejecutar."
  exit 1
fi

# 2) Colima + cliente Docker + compose
for pkg in colima docker docker-compose; do
  if ! brew list "$pkg" >/dev/null 2>&1; then
    log "Instalando ${pkg}..."
    brew install "$pkg"
  fi
done

# 3) Arrancar Colima con recursos suficientes
if ! colima status >/dev/null 2>&1; then
  log "Iniciando Colima (cpu=$COLIMA_CPU mem=${COLIMA_MEMORY}GB disk=${COLIMA_DISK}GB)..."
  colima start --cpu "$COLIMA_CPU" --memory "$COLIMA_MEMORY" --disk "$COLIMA_DISK"
else
  log "Colima ya está en marcha."
fi

# 4) Construir y levantar
log "Construyendo y levantando servicios (la primera vez tarda: MT3 es grande)..."
dc up -d --build

# 5) Esperar salud del backend web
log "Esperando a que el backend web responda en http://localhost:3002 ..."
for _ in $(seq 1 60); do
  if curl -sf http://localhost:3002/health >/dev/null 2>&1; then
    log "✓ Web listo: http://localhost:3002"
    break
  fi
  sleep 3
done

# 6) Esperar salud del servicio MT3 (carga el modelo; puede tardar)
log "Esperando al servicio de transcripción MT3 (carga el modelo, puede tardar 1-2 min)..."
for _ in $(seq 1 80); do
  if dc exec -T transcription curl -sf http://localhost:8000/health >/dev/null 2>&1; then
    log "✓ Servicio MT3 listo."
    break
  fi
  sleep 3
done

cat <<EOF

──────────────────────────────────────────────
  MusicLab AI corriendo en local en tu Mac
──────────────────────────────────────────────
  App / API:        http://localhost:3002
  En el plugin VST3, pon el campo "Backend":
                    http://localhost:3002

  Ver logs:         ./run-local-mac.sh logs
  Parar:            ./run-local-mac.sh stop
──────────────────────────────────────────────
EOF
