#!/bin/bash

#############################################
#  TicketZone - Script de Instalacion VPS  #
#############################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
APP_NAME="ticketzone"
APP_DIR="/opt/$APP_NAME"
REPO_URL=""
DOMAIN=""

print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║   ████████╗██╗ ██████╗██╗  ██╗███████╗████████╗           ║"
    echo "║   ╚══██╔══╝██║██╔════╝██║ ██╔╝██╔════╝╚══██╔══╝           ║"
    echo "║      ██║   ██║██║     █████╔╝ █████╗     ██║              ║"
    echo "║      ██║   ██║██║     ██╔═██╗ ██╔══╝     ██║              ║"
    echo "║      ██║   ██║╚██████╗██║  ██╗███████╗   ██║              ║"
    echo "║      ╚═╝   ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝   ╚═╝              ║"
    echo "║                                                           ║"
    echo "║        ███████╗ ██████╗ ███╗   ██╗███████╗               ║"
    echo "║        ╚══███╔╝██╔═══██╗████╗  ██║██╔════╝               ║"
    echo "║          ███╔╝ ██║   ██║██╔██╗ ██║█████╗                 ║"
    echo "║         ███╔╝  ██║   ██║██║╚██╗██║██╔══╝                 ║"
    echo "║        ███████╗╚██████╔╝██║ ╚████║███████╗               ║"
    echo "║        ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝               ║"
    echo "║                                                           ║"
    echo "║          Sistema de Venta de Entradas v1.0               ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "Este script debe ejecutarse como root"
        echo "Ejecuta: sudo ./install.sh"
        exit 1
    fi
}

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    else
        log_error "Sistema operativo no soportado"
        exit 1
    fi
    log_info "Sistema detectado: $OS $VER"
}

install_dependencies() {
    log_info "Instalando dependencias del sistema..."
    
    if command -v apt-get &> /dev/null; then
        apt-get update -qq
        apt-get install -y -qq curl wget git ca-certificates gnupg lsb-release
    elif command -v yum &> /dev/null; then
        yum update -y -q
        yum install -y -q curl wget git ca-certificates
    elif command -v dnf &> /dev/null; then
        dnf update -y -q
        dnf install -y -q curl wget git ca-certificates
    fi
    
    log_success "Dependencias instaladas"
}

install_docker() {
    if command -v docker &> /dev/null; then
        log_success "Docker ya esta instalado: $(docker --version)"
        return
    fi
    
    log_info "Instalando Docker..."
    
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    
    systemctl enable docker
    systemctl start docker
    
    log_success "Docker instalado: $(docker --version)"
}

install_docker_compose() {
    if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
        log_success "Docker Compose ya esta instalado"
        return
    fi
    
    log_info "Instalando Docker Compose..."
    
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    log_success "Docker Compose instalado"
}

setup_firewall() {
    log_info "Configurando firewall..."
    
    if command -v ufw &> /dev/null; then
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw allow 22/tcp
        ufw --force enable
        log_success "UFW configurado"
    elif command -v firewall-cmd &> /dev/null; then
        firewall-cmd --permanent --add-service=http
        firewall-cmd --permanent --add-service=https
        firewall-cmd --permanent --add-service=ssh
        firewall-cmd --reload
        log_success "Firewalld configurado"
    else
        log_warning "No se encontro firewall. Configura manualmente los puertos 80, 443, 22"
    fi
}

setup_app_directory() {
    log_info "Configurando directorio de la aplicacion..."
    
    mkdir -p $APP_DIR
    
    if [ -d "$(dirname "$0")/../app" ]; then
        cp -r "$(dirname "$0")/.." $APP_DIR/
        log_success "Archivos copiados a $APP_DIR"
    else
        log_warning "No se encontraron archivos de la app. Copia manualmente el proyecto a $APP_DIR"
    fi
}

configure_domain() {
    echo ""
    echo -e "${CYAN}=== Configuracion de Dominio ===${NC}"
    echo ""
    read -p "Introduce tu dominio (ej: ticketzone.com) o deja vacio para usar IP: " DOMAIN
    
    if [ -n "$DOMAIN" ]; then
        log_info "Configurando dominio: $DOMAIN"
        
        # Update nginx-ssl.conf with domain
        if [ -f "$APP_DIR/deploy/nginx-ssl.conf" ]; then
            sed -i "s/YOUR_DOMAIN.com/$DOMAIN/g" $APP_DIR/deploy/nginx-ssl.conf
            log_success "Configuracion SSL actualizada con dominio $DOMAIN"
        fi
    else
        log_info "Usando configuracion HTTP sin dominio"
    fi
}

setup_ssl() {
    if [ -z "$DOMAIN" ]; then
        log_warning "Sin dominio configurado. Saltando SSL."
        return
    fi
    
    echo ""
    read -p "Deseas configurar SSL con Let's Encrypt? (s/n): " SETUP_SSL
    
    if [[ "$SETUP_SSL" =~ ^[Ss]$ ]]; then
        log_info "Configurando SSL con Certbot..."
        
        # Install certbot
        if command -v apt-get &> /dev/null; then
            apt-get install -y certbot
        elif command -v yum &> /dev/null; then
            yum install -y certbot
        fi
        
        # Get certificate
        certbot certonly --standalone -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN || {
            log_warning "No se pudo obtener certificado SSL. Continuando sin SSL."
            return
        }
        
        # Use SSL config
        cp $APP_DIR/deploy/nginx-ssl.conf $APP_DIR/deploy/nginx.conf
        
        log_success "SSL configurado correctamente"
    fi
}

build_and_start() {
    log_info "Construyendo y desplegando la aplicacion..."
    
    cd $APP_DIR
    
    # Build and start with docker-compose
    if command -v docker-compose &> /dev/null; then
        docker-compose -f deploy/docker-compose.yml build --no-cache
        docker-compose -f deploy/docker-compose.yml up -d
    else
        docker compose -f deploy/docker-compose.yml build --no-cache
        docker compose -f deploy/docker-compose.yml up -d
    fi
    
    log_success "Aplicacion desplegada"
}

show_status() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           INSTALACION COMPLETADA CON EXITO!              ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "TU_IP")
    
    echo -e "${CYAN}Accede a tu aplicacion:${NC}"
    if [ -n "$DOMAIN" ]; then
        echo -e "  ${GREEN}https://$DOMAIN${NC}"
    else
        echo -e "  ${GREEN}http://$SERVER_IP${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}Comandos utiles:${NC}"
    echo -e "  Ver logs:        ${YELLOW}docker logs -f ticketzone-web${NC}"
    echo -e "  Reiniciar:       ${YELLOW}cd $APP_DIR && docker-compose -f deploy/docker-compose.yml restart${NC}"
    echo -e "  Detener:         ${YELLOW}cd $APP_DIR && docker-compose -f deploy/docker-compose.yml down${NC}"
    echo -e "  Actualizar:      ${YELLOW}cd $APP_DIR && docker-compose -f deploy/docker-compose.yml up -d --build${NC}"
    echo ""
    echo -e "${CYAN}Directorio de la app:${NC} $APP_DIR"
    echo ""
}

# Main installation flow
main() {
    print_banner
    
    echo -e "${YELLOW}Este script instalara TicketZone en tu servidor VPS${NC}"
    echo ""
    read -p "Continuar con la instalacion? (s/n): " CONTINUE
    
    if [[ ! "$CONTINUE" =~ ^[Ss]$ ]]; then
        echo "Instalacion cancelada."
        exit 0
    fi
    
    echo ""
    
    check_root
    detect_os
    install_dependencies
    install_docker
    install_docker_compose
    setup_firewall
    setup_app_directory
    configure_domain
    setup_ssl
    build_and_start
    show_status
}

# Run main
main "$@"
