#!/bin/bash

# Quick deploy script - Run from project root
# Usage: ./deploy/quick-deploy.sh

set -e

echo "🎫 TicketZone - Quick Deploy"
echo "============================"

# Check if docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no encontrado. Ejecuta install.sh primero."
    exit 1
fi

# Build and deploy
echo "📦 Construyendo imagen..."
docker build -t ticketzone-web -f deploy/Dockerfile .

echo "🚀 Desplegando..."
docker stop ticketzone-web 2>/dev/null || true
docker rm ticketzone-web 2>/dev/null || true

docker run -d \
    --name ticketzone-web \
    --restart unless-stopped \
    -p 80:80 \
    ticketzone-web

echo ""
echo "✅ Desplegado en http://$(curl -s ifconfig.me 2>/dev/null || echo 'localhost')"
echo ""
echo "Comandos:"
echo "  Ver logs:    docker logs -f ticketzone-web"
echo "  Reiniciar:   docker restart ticketzone-web"
echo "  Detener:     docker stop ticketzone-web"
