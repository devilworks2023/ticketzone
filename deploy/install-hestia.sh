#!/bin/bash

#############################################
#  TicketZone - Instalador para Hestia CP  #
#############################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
APP_NAME="ticketzone"
APP_PORT="3000"
HESTIA_DIR="/usr/local/hestia"

print_banner() {
    echo -e "${MAGENTA}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║   ████████╗██╗ ██████╗██╗  ██╗███████╗████████╗               ║"
    echo "║   ╚══██╔══╝██║██╔════╝██║ ██╔╝██╔════╝╚══██╔══╝               ║"
    echo "║      ██║   ██║██║     █████╔╝ █████╗     ██║                  ║"
    echo "║      ██║   ██║██║     ██╔═██╗ ██╔══╝     ██║                  ║"
    echo "║      ██║   ██║╚██████╗██║  ██╗███████╗   ██║                  ║"
    echo "║      ╚═╝   ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝   ╚═╝                  ║"
    echo "║                                                               ║"
    echo "║          ███████╗ ██████╗ ███╗   ██╗███████╗                  ║"
    echo "║          ╚══███╔╝██╔═══██╗████╗  ██║██╔════╝                  ║"
    echo "║            ███╔╝ ██║   ██║██╔██╗ ██║█████╗                    ║"
    echo "║           ███╔╝  ██║   ██║██║╚██╗██║██╔══╝                    ║"
    echo "║          ███████╗╚██████╔╝██║ ╚████║███████╗                  ║"
    echo "║          ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝                  ║"
    echo "║                                                               ║"
    echo "║      Instalador para Hestia Control Panel v1.0                ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "${MAGENTA}[PASO]${NC} $1"; }

# Check root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "Este script debe ejecutarse como root"
        echo "Ejecuta: sudo ./install-hestia.sh"
        exit 1
    fi
}

# Verify Hestia is installed
check_hestia() {
    log_step "Verificando Hestia Control Panel..."
    
    if [ ! -d "$HESTIA_DIR" ]; then
        log_error "Hestia Control Panel no esta instalado en este servidor"
        echo ""
        echo "Instala Hestia primero: https://hestiacp.com/install.html"
        exit 1
    fi
    
    if [ ! -f "$HESTIA_DIR/bin/v-list-users" ]; then
        log_error "Instalacion de Hestia incompleta"
        exit 1
    fi
    
    HESTIA_VERSION=$($HESTIA_DIR/bin/v-list-sys-info plain | grep VERSION | cut -d':' -f2 | tr -d ' ')
    log_success "Hestia CP detectado (Version: $HESTIA_VERSION)"
}

# List available users
list_hestia_users() {
    echo ""
    echo -e "${CYAN}Usuarios disponibles en Hestia:${NC}"
    echo "─────────────────────────────────"
    $HESTIA_DIR/bin/v-list-users plain | awk '{print "  • " $1}'
    echo "─────────────────────────────────"
    echo ""
}

# Get configuration from user
get_config() {
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo -e "${CYAN}       CONFIGURACION DE TICKETZONE           ${NC}"
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo ""
    
    # List users
    list_hestia_users
    
    # Get Hestia user
    read -p "Usuario de Hestia para el dominio: " HESTIA_USER
    
    if ! $HESTIA_DIR/bin/v-list-user $HESTIA_USER &>/dev/null; then
        log_error "Usuario '$HESTIA_USER' no existe en Hestia"
        echo ""
        read -p "¿Deseas crear el usuario? (s/n): " CREATE_USER
        if [[ "$CREATE_USER" =~ ^[Ss]$ ]]; then
            read -p "Email del usuario: " USER_EMAIL
            read -s -p "Password del usuario: " USER_PASS
            echo ""
            $HESTIA_DIR/bin/v-add-user $HESTIA_USER $USER_PASS $USER_EMAIL
            log_success "Usuario '$HESTIA_USER' creado"
        else
            exit 1
        fi
    fi
    
    log_success "Usuario: $HESTIA_USER"
    
    # Get domain
    echo ""
    read -p "Dominio para TicketZone (ej: tickets.tudominio.com): " DOMAIN
    
    if [ -z "$DOMAIN" ]; then
        log_error "El dominio es obligatorio"
        exit 1
    fi
    
    log_success "Dominio: $DOMAIN"
    
    # SSL option
    echo ""
    read -p "¿Activar SSL con Let's Encrypt? (s/n) [s]: " ENABLE_SSL
    ENABLE_SSL=${ENABLE_SSL:-s}
    
    # Port configuration
    echo ""
    read -p "Puerto interno para la app Docker [$APP_PORT]: " CUSTOM_PORT
    APP_PORT=${CUSTOM_PORT:-$APP_PORT}
    
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo -e "${CYAN}           RESUMEN DE CONFIGURACION          ${NC}"
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo -e "  Usuario:    ${GREEN}$HESTIA_USER${NC}"
    echo -e "  Dominio:    ${GREEN}$DOMAIN${NC}"
    echo -e "  SSL:        ${GREEN}$([[ "$ENABLE_SSL" =~ ^[Ss]$ ]] && echo "Si" || echo "No")${NC}"
    echo -e "  Puerto:     ${GREEN}$APP_PORT${NC}"
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo ""
    
    read -p "¿Continuar con esta configuracion? (s/n): " CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Ss]$ ]]; then
        log_warning "Instalacion cancelada"
        exit 0
    fi
}

# Install Docker if not present
install_docker() {
    log_step "Verificando Docker..."
    
    if command -v docker &>/dev/null; then
        log_success "Docker ya instalado: $(docker --version | cut -d' ' -f3)"
        return
    fi
    
    log_info "Instalando Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    log_success "Docker instalado"
}

# Create app directory
setup_app_directory() {
    log_step "Configurando directorio de la aplicacion..."
    
    APP_DIR="/home/$HESTIA_USER/web/$DOMAIN"
    DOCKER_DIR="$APP_DIR/docker"
    
    # Limpiar directorio anterior si existe
    if [ -d "$DOCKER_DIR" ]; then
        rm -rf "$DOCKER_DIR"/*
    fi
    mkdir -p "$DOCKER_DIR"
    
    # Obtener directorios
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
    
    log_info "Copiando desde: $PROJECT_DIR"
    log_info "Copiando a: $DOCKER_DIR"
    
    if [ -f "$SCRIPT_DIR/Dockerfile" ]; then
        # Usar rsync si está disponible (más confiable)
        if command -v rsync &>/dev/null; then
            rsync -av --exclude='.git' --exclude='node_modules' "$PROJECT_DIR/" "$DOCKER_DIR/"
        else
            # Copiar todo el proyecto
            cd "$PROJECT_DIR"
            for item in *; do
                if [ "$item" != "node_modules" ] && [ "$item" != ".git" ]; then
                    cp -r "$item" "$DOCKER_DIR/" 2>/dev/null || true
                fi
            done
            # Copiar archivos ocultos excepto .git
            for item in .[!.]*; do
                if [ "$item" != ".git" ] && [ -e "$item" ]; then
                    cp -r "$item" "$DOCKER_DIR/" 2>/dev/null || true
                fi
            done
        fi
        
        # Verificar que deploy existe
        if [ ! -d "$DOCKER_DIR/deploy" ]; then
            log_warning "Creando directorio deploy manualmente..."
            mkdir -p "$DOCKER_DIR/deploy"
            cp -f "$SCRIPT_DIR"/* "$DOCKER_DIR/deploy/"
        fi
        
        # Verificar archivos criticos
        if [ -f "$DOCKER_DIR/deploy/Dockerfile" ] && [ -f "$DOCKER_DIR/package.json" ]; then
            log_success "Archivos copiados a $DOCKER_DIR"
            ls -la "$DOCKER_DIR/deploy/" | head -5
        else
            log_error "Faltan archivos criticos. Contenido de $DOCKER_DIR:"
            ls -la "$DOCKER_DIR/"
            exit 1
        fi
    else
        log_warning "Copia manualmente los archivos del proyecto a: $DOCKER_DIR"
    fi
    
    chown -R $HESTIA_USER:$HESTIA_USER $APP_DIR
}

# Create Hestia domain
create_hestia_domain() {
    log_step "Creando dominio en Hestia..."
    
    # Check if domain exists
    if $HESTIA_DIR/bin/v-list-web-domain $HESTIA_USER $DOMAIN &>/dev/null; then
        log_warning "El dominio '$DOMAIN' ya existe"
        read -p "¿Deseas reconfigurarlo? (s/n): " RECONFIG
        if [[ "$RECONFIG" =~ ^[Ss]$ ]]; then
            $HESTIA_DIR/bin/v-delete-web-domain $HESTIA_USER $DOMAIN
            log_info "Dominio eliminado, recreando..."
        else
            log_info "Usando dominio existente"
            return
        fi
    fi
    
    # Create domain
    $HESTIA_DIR/bin/v-add-web-domain $HESTIA_USER $DOMAIN
    log_success "Dominio '$DOMAIN' creado en Hestia"
}

# Configure Nginx proxy for Docker
configure_nginx_proxy() {
    log_step "Configurando Nginx como proxy reverso..."
    
    NGINX_CONF_DIR="/home/$HESTIA_USER/conf/web"
    
    # Create custom nginx template for proxy
    cat > "$NGINX_CONF_DIR/$DOMAIN.nginx.conf" << 'NGINXEOF'
server {
    listen      %ip%:%web_port%;
    server_name %domain_idn% %alias_idn%;
    
    location / {
        proxy_pass http://127.0.0.1:DOCKER_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        proxy_connect_timeout 60;
        proxy_send_timeout 60;
    }

    location /error/ {
        alias /home/%user%/web/%domain%/document_errors/;
    }

    include /home/%user%/conf/web/%domain%/nginx.conf_*;
}
NGINXEOF

    # Replace port placeholder
    sed -i "s/DOCKER_PORT/$APP_PORT/g" "$NGINX_CONF_DIR/$DOMAIN.nginx.conf"
    
    # Create SSL version
    cat > "$NGINX_CONF_DIR/$DOMAIN.nginx.ssl.conf" << 'NGINXSSLEOF'
server {
    listen      %ip%:%web_ssl_port% ssl;
    server_name %domain_idn% %alias_idn%;
    
    ssl_certificate     /home/%user%/conf/web/%domain%/ssl/%domain%.pem;
    ssl_certificate_key /home/%user%/conf/web/%domain%/ssl/%domain%.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;
    
    location / {
        proxy_pass http://127.0.0.1:DOCKER_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        proxy_connect_timeout 60;
        proxy_send_timeout 60;
    }

    location /error/ {
        alias /home/%user%/web/%domain%/document_errors/;
    }

    include /home/%user%/conf/web/%domain%/nginx.ssl.conf_*;
}
NGINXSSLEOF

    sed -i "s/DOCKER_PORT/$APP_PORT/g" "$NGINX_CONF_DIR/$DOMAIN.nginx.ssl.conf"
    
    log_success "Configuracion Nginx creada"
}

# Setup SSL with Let's Encrypt via Hestia
setup_ssl_hestia() {
    if [[ ! "$ENABLE_SSL" =~ ^[Ss]$ ]]; then
        log_info "SSL omitido por configuracion"
        return
    fi
    
    log_step "Configurando SSL con Let's Encrypt..."
    
    # Enable SSL support for domain
    $HESTIA_DIR/bin/v-add-web-domain-ssl $HESTIA_USER $DOMAIN /home/$HESTIA_USER/conf/web/$DOMAIN/ssl 2>/dev/null || true
    
    # Request Let's Encrypt certificate
    $HESTIA_DIR/bin/v-add-letsencrypt-domain $HESTIA_USER $DOMAIN || {
        log_warning "No se pudo obtener certificado SSL automaticamente"
        log_info "Puedes configurarlo manualmente desde el panel de Hestia"
        return
    }
    
    log_success "Certificado SSL configurado"
}

# Create Docker compose for Hestia
create_docker_compose() {
    log_step "Creando configuracion Docker..."
    
    DOCKER_DIR="/home/$HESTIA_USER/web/$DOMAIN/docker"
    
    # Crear directorio si no existe
    if [ ! -d "$DOCKER_DIR" ]; then
        mkdir -p "$DOCKER_DIR" || {
            log_error "No se pudo crear el directorio: $DOCKER_DIR"
            # Intentar crear directorios padre
            mkdir -p "/home/$HESTIA_USER/web/$DOMAIN" 2>/dev/null
            mkdir -p "$DOCKER_DIR" || exit 1
        }
    fi
    
    # Verificar que el directorio existe
    if [ ! -d "$DOCKER_DIR" ]; then
        log_error "El directorio $DOCKER_DIR no existe y no se pudo crear"
        exit 1
    fi
    
    cat > "$DOCKER_DIR/docker-compose.hestia.yml" << COMPOSEEOF
services:
  ticketzone:
    build:
      context: .
      dockerfile: ./deploy/Dockerfile
    container_name: ticketzone-$HESTIA_USER
    restart: unless-stopped
    ports:
      - "127.0.0.1:$APP_PORT:80"
    environment:
      - NODE_ENV=production
      - TZ=Europe/Madrid
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  default:
    name: ticketzone-network
COMPOSEEOF

    chown $HESTIA_USER:$HESTIA_USER "$DOCKER_DIR/docker-compose.hestia.yml"
    log_success "Docker Compose creado"
}

# Build and start Docker container
start_docker_app() {
    log_step "Construyendo e iniciando aplicacion..."
    
    DOCKER_DIR="/home/$HESTIA_USER/web/$DOMAIN/docker"
    cd $DOCKER_DIR
    
    if command -v docker-compose &>/dev/null; then
        docker-compose -f docker-compose.hestia.yml build --no-cache
        docker-compose -f docker-compose.hestia.yml up -d
    else
        docker compose -f docker-compose.hestia.yml build --no-cache
        docker compose -f docker-compose.hestia.yml up -d
    fi
    
    log_success "Contenedor Docker iniciado"
}

# Restart Hestia services
restart_hestia_services() {
    log_step "Reiniciando servicios de Hestia..."
    
    # Rebuild domain configuration
    $HESTIA_DIR/bin/v-rebuild-web-domains $HESTIA_USER
    
    # Restart nginx
    systemctl restart nginx
    
    log_success "Servicios reiniciados"
}

# Create management script
create_management_script() {
    log_step "Creando script de gestion..."
    
    MANAGE_SCRIPT="/home/$HESTIA_USER/web/$DOMAIN/manage-ticketzone.sh"
    DOCKER_DIR="/home/$HESTIA_USER/web/$DOMAIN/docker"
    
    cat > "$MANAGE_SCRIPT" << MANAGEEOF
#!/bin/bash

#############################################
#  TicketZone - Script de Gestion           #
#############################################

DOCKER_DIR="$DOCKER_DIR"
COMPOSE_FILE="docker-compose.hestia.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

case "\$1" in
    start)
        echo -e "\${GREEN}Iniciando TicketZone...\${NC}"
        cd \$DOCKER_DIR && docker compose -f \$COMPOSE_FILE up -d
        ;;
    stop)
        echo -e "\${YELLOW}Deteniendo TicketZone...\${NC}"
        cd \$DOCKER_DIR && docker compose -f \$COMPOSE_FILE down
        ;;
    restart)
        echo -e "\${CYAN}Reiniciando TicketZone...\${NC}"
        cd \$DOCKER_DIR && docker compose -f \$COMPOSE_FILE restart
        ;;
    rebuild)
        echo -e "\${CYAN}Reconstruyendo TicketZone...\${NC}"
        cd \$DOCKER_DIR && docker compose -f \$COMPOSE_FILE up -d --build
        ;;
    logs)
        echo -e "\${CYAN}Mostrando logs (Ctrl+C para salir)...\${NC}"
        docker logs -f ticketzone-$HESTIA_USER
        ;;
    status)
        echo -e "\${CYAN}Estado de TicketZone:\${NC}"
        docker ps --filter "name=ticketzone-$HESTIA_USER" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        ;;
    update)
        echo -e "\${CYAN}Actualizando TicketZone...\${NC}"
        cd \$DOCKER_DIR
        docker compose -f \$COMPOSE_FILE down
        docker compose -f \$COMPOSE_FILE build --no-cache
        docker compose -f \$COMPOSE_FILE up -d
        echo -e "\${GREEN}Actualizacion completada!\${NC}"
        ;;
    *)
        echo ""
        echo -e "\${CYAN}TicketZone - Script de Gestion\${NC}"
        echo ""
        echo "Uso: \$0 {start|stop|restart|rebuild|logs|status|update}"
        echo ""
        echo "  start    - Inicia la aplicacion"
        echo "  stop     - Detiene la aplicacion"
        echo "  restart  - Reinicia la aplicacion"
        echo "  rebuild  - Reconstruye y reinicia"
        echo "  logs     - Muestra logs en tiempo real"
        echo "  status   - Muestra estado actual"
        echo "  update   - Actualiza la aplicacion"
        echo ""
        ;;
esac
MANAGEEOF

    chmod +x "$MANAGE_SCRIPT"
    chown $HESTIA_USER:$HESTIA_USER "$MANAGE_SCRIPT"
    log_success "Script de gestion creado: $MANAGE_SCRIPT"
}

# Create systemd service for auto-start
create_systemd_service() {
    log_step "Creando servicio systemd para inicio automatico..."
    
    DOCKER_DIR="/home/$HESTIA_USER/web/$DOMAIN/docker"
    
    cat > "/etc/systemd/system/ticketzone-$HESTIA_USER.service" << SERVICEEOF
[Unit]
Description=TicketZone App for $DOMAIN
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$DOCKER_DIR
ExecStart=/usr/bin/docker compose -f docker-compose.hestia.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.hestia.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
SERVICEEOF

    systemctl daemon-reload
    systemctl enable ticketzone-$HESTIA_USER.service
    log_success "Servicio systemd creado y habilitado"
}

# Show final status
show_final_status() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                               ║${NC}"
    echo -e "${GREEN}║         ¡INSTALACION COMPLETADA CON EXITO!                   ║${NC}"
    echo -e "${GREEN}║                                                               ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo -e "${CYAN}           INFORMACION DE ACCESO             ${NC}"
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo ""
    
    if [[ "$ENABLE_SSL" =~ ^[Ss]$ ]]; then
        echo -e "  ${GREEN}URL:${NC} https://$DOMAIN"
    else
        echo -e "  ${GREEN}URL:${NC} http://$DOMAIN"
    fi
    
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo -e "${CYAN}           COMANDOS DE GESTION               ${NC}"
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${YELLOW}Ver estado:${NC}"
    echo -e "    /home/$HESTIA_USER/web/$DOMAIN/manage-ticketzone.sh status"
    echo ""
    echo -e "  ${YELLOW}Ver logs:${NC}"
    echo -e "    /home/$HESTIA_USER/web/$DOMAIN/manage-ticketzone.sh logs"
    echo ""
    echo -e "  ${YELLOW}Reiniciar:${NC}"
    echo -e "    /home/$HESTIA_USER/web/$DOMAIN/manage-ticketzone.sh restart"
    echo ""
    echo -e "  ${YELLOW}Actualizar:${NC}"
    echo -e "    /home/$HESTIA_USER/web/$DOMAIN/manage-ticketzone.sh update"
    echo ""
    echo -e "  ${YELLOW}Detener:${NC}"
    echo -e "    /home/$HESTIA_USER/web/$DOMAIN/manage-ticketzone.sh stop"
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo -e "${CYAN}           ARCHIVOS IMPORTANTES              ${NC}"
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${BLUE}Directorio app:${NC}   /home/$HESTIA_USER/web/$DOMAIN/docker"
    echo -e "  ${BLUE}Script gestion:${NC}   /home/$HESTIA_USER/web/$DOMAIN/manage-ticketzone.sh"
    echo -e "  ${BLUE}Docker Compose:${NC}   docker-compose.hestia.yml"
    echo -e "  ${BLUE}Servicio:${NC}         ticketzone-$HESTIA_USER.service"
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo -e "${CYAN}            PANEL DE HESTIA                  ${NC}"
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  El dominio esta configurado en Hestia."
    echo -e "  Puedes gestionar SSL y DNS desde el panel."
    echo ""
    
    # Check if app is running
    sleep 3
    if docker ps --filter "name=ticketzone-$HESTIA_USER" --format "{{.Status}}" | grep -q "Up"; then
        echo -e "${GREEN}✓ La aplicacion esta funcionando correctamente${NC}"
    else
        echo -e "${YELLOW}! Verifica el estado con: docker logs ticketzone-$HESTIA_USER${NC}"
    fi
    
    echo ""
}

# Main function
main() {
    print_banner
    
    echo -e "${YELLOW}Este script instalara TicketZone en tu servidor con Hestia CP${NC}"
    echo ""
    
    read -p "¿Continuar con la instalacion? (s/n): " CONTINUE
    if [[ ! "$CONTINUE" =~ ^[Ss]$ ]]; then
        echo "Instalacion cancelada."
        exit 0
    fi
    
    check_root
    check_hestia
    get_config
    install_docker
    setup_app_directory
    create_hestia_domain
    configure_nginx_proxy
    create_docker_compose
    start_docker_app
    setup_ssl_hestia
    restart_hestia_services
    create_management_script
    create_systemd_service
    show_final_status
}

# Run
main "$@"
