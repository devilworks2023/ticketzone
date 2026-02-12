#!/bin/sh

echo "╔═══════════════════════════════════════════╗"
echo "║        TicketZone - Iniciando...          ║"
echo "╚═══════════════════════════════════════════╝"

mkdir -p /app/data
chmod 755 /app/data

# Verificar permisos de escritura en el directorio de datos
if touch /app/data/.write_test 2>/dev/null; then
    rm /app/data/.write_test
    echo "[OK] Permisos de escritura en /app/data verificados"
else
    echo "[ERROR] No se puede escribir en /app/data"
    exit 1
fi

# Mostrar información del volumen
echo "[INFO] Contenido de /app/data:"
ls -la /app/data/

echo ""
echo "[1/3] Iniciando Nginx en background..."
nginx &
NGINX_PID=$!

echo "[2/3] Esperando que Nginx inicie..."
sleep 2

if ! kill -0 $NGINX_PID 2>/dev/null; then
    echo "ERROR: Nginx no pudo iniciar"
    exit 1
fi
echo "[OK] Nginx iniciado (PID: $NGINX_PID)"

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║     TicketZone iniciado correctamente     ║"
echo "║                                           ║"
echo "║  Frontend: http://localhost               ║"
echo "║  API:      http://localhost/api           ║"
echo "╚═══════════════════════════════════════════╝"
echo ""
echo "[3/3] Iniciando backend Node.js (logs en tiempo real)..."
echo "=========================================================="
echo ""

# Trap para limpiar procesos al salir
trap "echo 'Cerrando...'; kill $NGINX_PID 2>/dev/null; exit" SIGTERM SIGINT

# Ejecutar backend en PRIMER PLANO para ver logs en tiempo real
cd /app
exec node --experimental-specifier-resolution=node backend/server.js
