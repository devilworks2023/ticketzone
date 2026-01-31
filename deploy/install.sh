#!/bin/bash

# TicketZone - Script de instalación completo para VPS
# Este script instala y configura todo lo necesario

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }

# Configuración
INSTALL_DIR="${INSTALL_DIR:-/opt/ticketzone}"
DOMAIN="${DOMAIN:-localhost}"
PORT="${PORT:-8080}"

echo "==========================================="
echo "   TicketZone - Instalación Completa"
echo "==========================================="
echo ""

# Verificar que se ejecuta como root
if [ "$EUID" -ne 0 ]; then
    print_error "Este script debe ejecutarse como root"
    print_status "Ejecuta: sudo $0"
    exit 1
fi

# Verificar Docker
print_status "Verificando Docker..."
if ! command -v docker &> /dev/null; then
    print_warning "Docker no está instalado. Instalando..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    print_success "Docker instalado correctamente"
else
    print_success "Docker ya está instalado"
fi

# Verificar Docker Compose
print_status "Verificando Docker Compose..."
if ! docker compose version &> /dev/null; then
    print_warning "Docker Compose no disponible. Instalando plugin..."
    apt-get update && apt-get install -y docker-compose-plugin
    print_success "Docker Compose instalado"
else
    print_success "Docker Compose disponible"
fi

# Crear directorio de instalación
print_status "Creando directorio de instalación: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Copiar archivos del proyecto
print_status "Copiando archivos del proyecto..."
if [ -d "/tmp/ticketzone" ]; then
    cp -r /tmp/ticketzone/* "$INSTALL_DIR/"
    print_success "Archivos copiados desde /tmp/ticketzone"
elif [ -d "$(dirname "$0")/.." ]; then
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
    cp -r "$PROJECT_DIR"/* "$INSTALL_DIR/"
    print_success "Archivos copiados desde directorio del script"
else
    print_error "No se encontraron los archivos del proyecto"
    print_status "Asegúrate de que los archivos estén en /tmp/ticketzone o ejecuta desde el directorio del proyecto"
    exit 1
fi

# Verificar archivos necesarios
print_status "Verificando archivos necesarios..."

REQUIRED_FILES=(
    "deploy/Dockerfile"
    "deploy/package.deploy.json"
    "deploy/nginx.conf"
    "deploy/docker-compose.yml"
    "app/_layout.tsx"
    "app.json"
)

MISSING_FILES=()
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$INSTALL_DIR/$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -ne 0 ]; then
    print_error "Archivos faltantes:"
    for file in "${MISSING_FILES[@]}"; do
        echo "  - $file"
    done
    exit 1
fi
print_success "Todos los archivos necesarios están presentes"

# Detener contenedor existente si existe
print_status "Verificando contenedores existentes..."
if docker ps -a --format '{{.Names}}' | grep -q "ticketzone"; then
    print_warning "Deteniendo contenedor existente..."
    docker stop ticketzone-web 2>/dev/null || true
    docker rm ticketzone-web 2>/dev/null || true
    print_success "Contenedor anterior eliminado"
fi

# Construir imagen
print_status "Construyendo imagen Docker (esto puede tardar unos minutos)..."
cd "$INSTALL_DIR"
docker compose -f deploy/docker-compose.yml build --no-cache

if [ $? -eq 0 ]; then
    print_success "Imagen construida correctamente"
else
    print_error "Error al construir la imagen"
    exit 1
fi

# Iniciar contenedor
print_status "Iniciando contenedor..."
docker compose -f deploy/docker-compose.yml up -d

if [ $? -eq 0 ]; then
    print_success "Contenedor iniciado correctamente"
else
    print_error "Error al iniciar el contenedor"
    exit 1
fi

# Esperar a que el servicio esté listo
print_status "Esperando a que el servicio esté listo..."
sleep 5

# Verificar que está funcionando
if curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/health | grep -q "200"; then
    print_success "Servicio funcionando correctamente"
else
    print_warning "El servicio puede tardar unos segundos más en estar disponible"
fi

# Mostrar información final
echo ""
echo "==========================================="
echo -e "${GREEN}   ¡Instalación Completada!${NC}"
echo "==========================================="
echo ""
echo "Información del servicio:"
echo "  - URL Local: http://localhost:$PORT"
echo "  - Directorio: $INSTALL_DIR"
echo ""
echo "Comandos útiles:"
echo "  - Ver logs: docker logs -f ticketzone-web"
echo "  - Reiniciar: docker restart ticketzone-web"
echo "  - Detener: docker stop ticketzone-web"
echo "  - Estado: docker ps | grep ticketzone"
echo ""
echo "Para configurar con tu dominio ($DOMAIN):"
echo "  1. Configura el proxy reverso de HestiaCP apuntando al puerto $PORT"
echo "  2. O usa el archivo nginx-ssl.conf como referencia"
echo ""
