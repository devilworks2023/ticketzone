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
echo "[1/3] Iniciando Nginx..."
nginx

echo "[2/3] Verificando que Nginx esté corriendo..."
sleep 2

if [ -f /var/run/nginx.pid ] && kill -0 $(cat /var/run/nginx.pid) 2>/dev/null; then
    NGINX_PID=$(cat /var/run/nginx.pid)
    echo "[OK] Nginx iniciado (PID: $NGINX_PID)"
else
    echo "ERROR: Nginx no pudo iniciar"
    echo "Verificando logs de error:"
    cat /var/log/nginx/error.log 2>/dev/null || echo "No hay logs disponibles"
    nginx -t 2>&1
    exit 1
fi

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
trap "echo 'Cerrando...'; nginx -s quit 2>/dev/null; exit" SIGTERM SIGINT

# Ejecutar backend en PRIMER PLANO para ver logs en tiempo real
cd /app
exec node --experimental-specifier-resolution=node backend/server.js
