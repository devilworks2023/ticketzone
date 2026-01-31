#!/bin/bash

# TicketZone - Despliegue Rápido
# Ejecutar desde el directorio del proyecto

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}[INFO]${NC} Iniciando despliegue de TicketZone..."

# Verificar que estamos en el directorio correcto
if [ ! -f "deploy/Dockerfile" ]; then
    echo -e "${RED}[ERROR]${NC} Ejecuta este script desde la raíz del proyecto"
    exit 1
fi

# Verificar que package.deploy.json existe
if [ ! -f "deploy/package.deploy.json" ]; then
    echo -e "${RED}[ERROR]${NC} Falta deploy/package.deploy.json"
    exit 1
fi

# Detener contenedor existente
echo -e "${BLUE}[INFO]${NC} Limpiando contenedores anteriores..."
docker stop ticketzone-web 2>/dev/null || true
docker rm ticketzone-web 2>/dev/null || true

# Construir y desplegar
echo -e "${BLUE}[INFO]${NC} Construyendo imagen..."
docker compose -f deploy/docker-compose.yml build --no-cache

echo -e "${BLUE}[INFO]${NC} Iniciando servicio..."
docker compose -f deploy/docker-compose.yml up -d

echo -e "${GREEN}[✓]${NC} Despliegue completado"
echo ""
echo "URL: http://localhost:8080"
echo "Logs: docker logs -f ticketzone-web"
