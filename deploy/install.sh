#!/bin/bash

#############################################
#  TicketZone - Instalador para Ubuntu 24.04
#  VPS limpio sin panel de control
#############################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "${MAGENTA}[PASO]${NC} $1"; }

print_banner() {
    clear
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
    echo "║        Instalador para Ubuntu 24.04 (VPS limpio)              ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "Este script debe ejecutarse como root"
        echo "Ejecuta: sudo bash install.sh"
        exit 1
    fi
}

check_ubuntu() {
    if [ ! -f /etc/os-release ]; then
        log_error "No se puede detectar el sistema operativo"
        exit 1
    fi
    
    . /etc/os-release
    if [[ "$ID" != "ubuntu" ]]; then
        log_warning "Este script esta optimizado para Ubuntu. Sistema detectado: $ID"
        read -p "¿Deseas continuar de todos modos? (s/n): " CONTINUE
        if [[ ! "$CONTINUE" =~ ^[Ss]$ ]]; then
            exit 1
        fi
    else
        log_success "Sistema operativo: Ubuntu $VERSION_ID"
    fi
}

get_config() {
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo -e "${CYAN}         CONFIGURACION DE TICKETZONE         ${NC}"
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo ""
    
    # Dominio
    while true; do
        read -p "Dominio para la aplicacion (ej: tickets.tudominio.com): " DOMAIN
        if [ -z "$DOMAIN" ]; then
            log_error "El dominio es obligatorio"
        else
            break
        fi
    done
    
    # Email para SSL
    echo ""
    read -p "Email para certificado SSL (Let's Encrypt): " SSL_EMAIL
    if [ -z "$SSL_EMAIL" ]; then
        log_warning "Sin email, no se podra configurar SSL automaticamente"
        ENABLE_SSL="n"
    else
        ENABLE_SSL="s"
    fi
    
    # Puerto interno
    echo ""
    read -p "Puerto interno para Docker [3080]: " APP_PORT
    APP_PORT=${APP_PORT:-3080}
    
    # Directorio de instalacion
    echo ""
    read -p "Directorio de instalacion [/opt/ticketzone]: " INSTALL_DIR
    INSTALL_DIR=${INSTALL_DIR:-/opt/ticketzone}
    
    # Firewall
    echo ""
    read -p "¿Configurar firewall UFW? (s/n) [s]: " SETUP_UFW
    SETUP_UFW=${SETUP_UFW:-s}
    
    # Resumen
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo -e "${CYAN}         RESUMEN DE CONFIGURACION            ${NC}"
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo -e "  Dominio:      ${GREEN}$DOMAIN${NC}"
    echo -e "  Email SSL:    ${GREEN}${SSL_EMAIL:-No configurado}${NC}"
    echo -e "  SSL:          ${GREEN}$([[ "$ENABLE_SSL" =~ ^[Ss]$ ]] && echo "Si" || echo "No")${NC}"
    echo -e "  Puerto:       ${GREEN}$APP_PORT${NC}"
    echo -e "  Directorio:   ${GREEN}$INSTALL_DIR${NC}"
    echo -e "  Firewall:     ${GREEN}$([[ "$SETUP_UFW" =~ ^[Ss]$ ]] && echo "Si" || echo "No")${NC}"
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo ""
    
    read -p "¿Continuar con esta configuracion? (s/n): " CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Ss]$ ]]; then
        log_warning "Instalacion cancelada"
        exit 0
    fi
}

update_system() {
    log_step "Actualizando sistema..."
    apt-get update -y
    apt-get upgrade -y
    log_success "Sistema actualizado"
}

install_dependencies() {
    log_step "Instalando dependencias..."
    apt-get install -y \
        curl \
        wget \
        git \
        ca-certificates \
        gnupg \
        lsb-release \
        software-properties-common \
        ufw
    log_success "Dependencias instaladas"
}

install_docker() {
    log_step "Verificando Docker..."
    
    if command -v docker &>/dev/null; then
        log_success "Docker ya instalado: $(docker --version | cut -d' ' -f3)"
    else
        log_info "Instalando Docker..."
        
        # Eliminar versiones antiguas
        apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
        
        # Instalar Docker oficial
        curl -fsSL https://get.docker.com | sh
        
        # Habilitar e iniciar
        systemctl enable docker
        systemctl start docker
        
        log_success "Docker instalado: $(docker --version | cut -d' ' -f3)"
    fi
    
    # Verificar Docker Compose
    if docker compose version &>/dev/null; then
        log_success "Docker Compose disponible"
    else
        log_info "Instalando Docker Compose plugin..."
        apt-get install -y docker-compose-plugin
        log_success "Docker Compose instalado"
    fi
}

install_nginx() {
    log_step "Instalando Nginx..."
    
    if command -v nginx &>/dev/null; then
        log_success "Nginx ya instalado"
    else
        apt-get install -y nginx
        systemctl enable nginx
        systemctl start nginx
        log_success "Nginx instalado"
    fi
}

install_certbot() {
    if [[ ! "$ENABLE_SSL" =~ ^[Ss]$ ]]; then
        log_info "SSL no configurado, omitiendo Certbot"
        return
    fi
    
    log_step "Instalando Certbot para SSL..."
    
    if command -v certbot &>/dev/null; then
        log_success "Certbot ya instalado"
    else
        apt-get install -y certbot python3-certbot-nginx
        log_success "Certbot instalado"
    fi
}

setup_firewall() {
    if [[ ! "$SETUP_UFW" =~ ^[Ss]$ ]]; then
        log_info "Configuracion de firewall omitida"
        return
    fi
    
    log_step "Configurando firewall UFW..."
    
    # Permitir SSH primero (MUY IMPORTANTE)
    ufw allow ssh
    ufw allow 22/tcp
    
    # Permitir HTTP y HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Permitir Nginx
    ufw allow 'Nginx Full'
    
    # Habilitar firewall
    echo "y" | ufw enable
    
    log_success "Firewall configurado"
    ufw status
}

setup_app_directory() {
    log_step "Configurando directorio de la aplicacion..."
    
    # Crear directorio
    mkdir -p "$INSTALL_DIR"
    
    # Detectar donde estan los archivos del proyecto
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    if [ -f "$SCRIPT_DIR/../package.json" ]; then
        PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
        log_info "Proyecto encontrado en: $PROJECT_DIR"
    elif [ -f "/tmp/ticketzone/package.json" ]; then
        PROJECT_DIR="/tmp/ticketzone"
        log_info "Proyecto encontrado en: $PROJECT_DIR"
    else
        log_error "No se encontro el proyecto"
        log_info "Opciones:"
        log_info "  1. Ejecuta este script desde el directorio del proyecto"
        log_info "  2. Clona el proyecto en /tmp/ticketzone primero:"
        log_info "     git clone https://github.com/TU_USUARIO/ticketzone.git /tmp/ticketzone"
        exit 1
    fi
    
    # Copiar archivos
    log_info "Copiando archivos a $INSTALL_DIR..."
    cp -r "$PROJECT_DIR"/* "$INSTALL_DIR/"
    cp -r "$PROJECT_DIR"/.[!.]* "$INSTALL_DIR/" 2>/dev/null || true
    
    # Limpiar archivos innecesarios
    rm -rf "$INSTALL_DIR/node_modules" 2>/dev/null || true
    rm -rf "$INSTALL_DIR/.git" 2>/dev/null || true
    
    log_success "Archivos copiados a $INSTALL_DIR"
}

create_env_file() {
    log_step "Creando archivo de configuracion..."
    
    cat > "$INSTALL_DIR/.env" << ENVEOF
# TicketZone - Configuracion
DOMAIN=$DOMAIN
APP_PORT=$APP_PORT
NODE_ENV=production
TZ=Europe/Madrid
ENVEOF

    log_success "Archivo .env creado"
}

configure_nginx() {
    log_step "Configurando Nginx como proxy reverso..."
    
    # Crear configuracion para el dominio
    cat > "/etc/nginx/sites-available/$DOMAIN" << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
        proxy_connect_timeout 60;
        proxy_send_timeout 60;
        
        # Gzip
        gzip on;
        gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:$APP_PORT/health;
        access_log off;
    }
}
NGINXEOF

    # Habilitar sitio
    ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
    
    # Eliminar default si existe
    rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
    
    # Verificar configuracion
    nginx -t
    
    # Reiniciar Nginx
    systemctl restart nginx
    
    log_success "Nginx configurado para $DOMAIN"
}

setup_ssl() {
    if [[ ! "$ENABLE_SSL" =~ ^[Ss]$ ]]; then
        log_info "SSL no configurado"
        return
    fi
    
    log_step "Configurando SSL con Let's Encrypt..."
    
    # Obtener certificado
    certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$SSL_EMAIL" --redirect || {
        log_warning "No se pudo obtener certificado para www.$DOMAIN"
        log_info "Intentando solo con $DOMAIN..."
        certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$SSL_EMAIL" --redirect || {
            log_warning "No se pudo obtener certificado SSL automaticamente"
            log_info "Puedes intentarlo manualmente mas tarde con:"
            log_info "  certbot --nginx -d $DOMAIN"
            return
        }
    }
    
    # Configurar renovacion automatica
    systemctl enable certbot.timer
    systemctl start certbot.timer
    
    log_success "Certificado SSL configurado"
}

build_docker_app() {
    log_step "Construyendo aplicacion Docker..."
    
    cd "$INSTALL_DIR"
    
    # Verificar archivos necesarios
    if [ ! -f "deploy/Dockerfile" ]; then
        log_error "Dockerfile no encontrado en deploy/"
        exit 1
    fi
    
    if [ ! -f "deploy/docker-compose.yml" ]; then
        log_error "docker-compose.yml no encontrado en deploy/"
        exit 1
    fi
    
    # Actualizar puerto en docker-compose
    sed -i "s/3080:80/$APP_PORT:80/g" deploy/docker-compose.yml
    
    # Detener contenedor existente
    docker stop ticketzone-app 2>/dev/null || true
    docker rm ticketzone-app 2>/dev/null || true
    
    # Construir imagen
    log_info "Construyendo imagen (esto puede tardar varios minutos)..."
    docker compose -f deploy/docker-compose.yml build --no-cache
    
    # Iniciar contenedor
    log_info "Iniciando contenedor..."
    docker compose -f deploy/docker-compose.yml up -d
    
    log_success "Aplicacion Docker iniciada"
}

create_systemd_service() {
    log_step "Creando servicio systemd para inicio automatico..."
    
    cat > "/etc/systemd/system/ticketzone.service" << SERVICEEOF
[Unit]
Description=TicketZone Application
Requires=docker.service
After=docker.service nginx.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/docker compose -f deploy/docker-compose.yml up -d
ExecStop=/usr/bin/docker compose -f deploy/docker-compose.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
SERVICEEOF

    systemctl daemon-reload
    systemctl enable ticketzone.service
    
    log_success "Servicio systemd creado y habilitado"
}

create_management_script() {
    log_step "Creando script de gestion..."
    
    cat > "$INSTALL_DIR/ticketzone.sh" << 'MANAGEEOF'
#!/bin/bash

INSTALL_DIR="INSTALL_DIR_PLACEHOLDER"
cd "$INSTALL_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

case "$1" in
    start)
        echo -e "${GREEN}Iniciando TicketZone...${NC}"
        docker compose -f deploy/docker-compose.yml up -d
        ;;
    stop)
        echo -e "${YELLOW}Deteniendo TicketZone...${NC}"
        docker compose -f deploy/docker-compose.yml down
        ;;
    restart)
        echo -e "${CYAN}Reiniciando TicketZone...${NC}"
        docker compose -f deploy/docker-compose.yml restart
        ;;
    rebuild)
        echo -e "${CYAN}Reconstruyendo TicketZone...${NC}"
        docker compose -f deploy/docker-compose.yml down
        docker compose -f deploy/docker-compose.yml build --no-cache
        docker compose -f deploy/docker-compose.yml up -d
        ;;
    logs)
        echo -e "${CYAN}Mostrando logs (Ctrl+C para salir)...${NC}"
        docker logs -f ticketzone-app
        ;;
    status)
        echo -e "${CYAN}Estado de TicketZone:${NC}"
        docker ps --filter "name=ticketzone-app" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        echo -e "${CYAN}Estado de Nginx:${NC}"
        systemctl status nginx --no-pager -l | head -5
        ;;
    update)
        echo -e "${CYAN}Actualizando TicketZone...${NC}"
        docker compose -f deploy/docker-compose.yml down
        git pull 2>/dev/null || echo "Git no disponible, actualizacion manual requerida"
        docker compose -f deploy/docker-compose.yml build --no-cache
        docker compose -f deploy/docker-compose.yml up -d
        echo -e "${GREEN}Actualizacion completada!${NC}"
        ;;
    ssl-renew)
        echo -e "${CYAN}Renovando certificado SSL...${NC}"
        certbot renew
        systemctl restart nginx
        ;;
    *)
        echo ""
        echo -e "${CYAN}TicketZone - Script de Gestion${NC}"
        echo ""
        echo "Uso: $0 {start|stop|restart|rebuild|logs|status|update|ssl-renew}"
        echo ""
        echo "  start      - Inicia la aplicacion"
        echo "  stop       - Detiene la aplicacion"
        echo "  restart    - Reinicia la aplicacion"
        echo "  rebuild    - Reconstruye desde cero"
        echo "  logs       - Muestra logs en tiempo real"
        echo "  status     - Muestra estado actual"
        echo "  update     - Actualiza la aplicacion"
        echo "  ssl-renew  - Renueva certificado SSL"
        echo ""
        ;;
esac
MANAGEEOF

    sed -i "s|INSTALL_DIR_PLACEHOLDER|$INSTALL_DIR|g" "$INSTALL_DIR/ticketzone.sh"
    chmod +x "$INSTALL_DIR/ticketzone.sh"
    
    # Crear enlace simbolico en /usr/local/bin
    ln -sf "$INSTALL_DIR/ticketzone.sh" /usr/local/bin/ticketzone
    
    log_success "Script de gestion creado: ticketzone"
}

verify_installation() {
    log_step "Verificando instalacion..."
    
    sleep 5
    
    # Verificar Docker
    if docker ps --filter "name=ticketzone-app" --format "{{.Status}}" | grep -q "Up"; then
        log_success "Contenedor Docker funcionando"
    else
        log_warning "Contenedor Docker no esta corriendo"
        log_info "Verifica con: docker logs ticketzone-app"
    fi
    
    # Verificar Nginx
    if systemctl is-active --quiet nginx; then
        log_success "Nginx funcionando"
    else
        log_warning "Nginx no esta activo"
    fi
    
    # Verificar respuesta local
    if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$APP_PORT" | grep -qE "200|301|302"; then
        log_success "Aplicacion responde en puerto $APP_PORT"
    else
        log_warning "Aplicacion no responde aun (puede tardar unos segundos mas)"
    fi
}

show_final_info() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                               ║${NC}"
    echo -e "${GREEN}║         ¡INSTALACION COMPLETADA CON EXITO!                    ║${NC}"
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
    echo -e "  ${YELLOW}Ver estado:${NC}     ticketzone status"
    echo -e "  ${YELLOW}Ver logs:${NC}       ticketzone logs"
    echo -e "  ${YELLOW}Reiniciar:${NC}      ticketzone restart"
    echo -e "  ${YELLOW}Reconstruir:${NC}    ticketzone rebuild"
    echo -e "  ${YELLOW}Detener:${NC}        ticketzone stop"
    echo -e "  ${YELLOW}Actualizar:${NC}     ticketzone update"
    echo ""
    
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo -e "${CYAN}           RUTAS IMPORTANTES                 ${NC}"
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${BLUE}Directorio app:${NC}     $INSTALL_DIR"
    echo -e "  ${BLUE}Nginx config:${NC}       /etc/nginx/sites-available/$DOMAIN"
    echo -e "  ${BLUE}Logs Docker:${NC}        docker logs ticketzone-app"
    echo -e "  ${BLUE}Logs Nginx:${NC}         /var/log/nginx/"
    echo ""
    
    if [[ "$ENABLE_SSL" =~ ^[Ss]$ ]]; then
        echo -e "${CYAN}════════════════════════════════════════════${NC}"
        echo -e "${CYAN}              CERTIFICADO SSL               ${NC}"
        echo -e "${CYAN}════════════════════════════════════════════${NC}"
        echo ""
        echo -e "  El certificado se renueva automaticamente."
        echo -e "  Para renovar manualmente: ticketzone ssl-renew"
        echo ""
    fi
    
    echo -e "${GREEN}¡Listo! Tu aplicacion deberia estar funcionando en:${NC}"
    if [[ "$ENABLE_SSL" =~ ^[Ss]$ ]]; then
        echo -e "${GREEN}  https://$DOMAIN${NC}"
    else
        echo -e "${GREEN}  http://$DOMAIN${NC}"
    fi
    echo ""
}

main() {
    print_banner
    
    echo -e "${YELLOW}Este script instalara TicketZone en tu servidor Ubuntu 24.04${NC}"
    echo -e "${YELLOW}Se instalara: Docker, Nginx, Certbot (SSL) y la aplicacion${NC}"
    echo ""
    
    read -p "¿Continuar con la instalacion? (s/n): " CONTINUE
    if [[ ! "$CONTINUE" =~ ^[Ss]$ ]]; then
        echo "Instalacion cancelada."
        exit 0
    fi
    
    check_root
    check_ubuntu
    get_config
    update_system
    install_dependencies
    install_docker
    install_nginx
    install_certbot
    setup_firewall
    setup_app_directory
    create_env_file
    build_docker_app
    configure_nginx
    setup_ssl
    create_systemd_service
    create_management_script
    verify_installation
    show_final_info
}

main "$@"
