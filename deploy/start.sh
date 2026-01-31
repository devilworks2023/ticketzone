#!/bin/sh

echo "╔═══════════════════════════════════════════╗"
echo "║        TicketZone - Iniciando...          ║"
echo "╚═══════════════════════════════════════════╝"

mkdir -p /app/data
chmod 755 /app/data

echo "[1/3] Iniciando backend Node.js..."
cd /app
node --experimental-specifier-resolution=node backend/server.js &
BACKEND_PID=$!

sleep 3

if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "ERROR: Backend no pudo iniciar"
    exit 1
fi

echo "[2/3] Verificando backend..."
for i in $(seq 1 30); do
    if curl -s http://127.0.0.1:3001/health > /dev/null 2>&1; then
        echo "Backend funcionando correctamente"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "WARNING: Backend tardando en responder, continuando..."
    fi
    sleep 1
done

echo "[3/3] Iniciando Nginx..."
nginx -g 'daemon off;' &
NGINX_PID=$!

echo "╔═══════════════════════════════════════════╗"
echo "║     TicketZone iniciado correctamente     ║"
echo "║                                           ║"
echo "║  Frontend: http://localhost               ║"
echo "║  API:      http://localhost/api           ║"
echo "╚═══════════════════════════════════════════╝"

trap "kill $BACKEND_PID $NGINX_PID 2>/dev/null; exit" SIGTERM SIGINT

wait $NGINX_PID
