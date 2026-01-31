# TicketZone - Guía de Despliegue en Ubuntu 24.04

## Requisitos
- VPS con Ubuntu 24.04 LTS (limpio, sin panel)
- Mínimo 1GB RAM, 1 CPU
- Dominio apuntando al servidor (DNS configurado)
- Acceso root al servidor

## Instalación Automática (Recomendado)

### 1. Conectar al servidor
```bash
ssh root@TU_IP_DEL_SERVIDOR
```

### 2. Descargar el proyecto
```bash
cd /tmp
git clone https://github.com/TU_USUARIO/ticketzone.git
cd ticketzone
```

### 3. Ejecutar el instalador
```bash
chmod +x deploy/install.sh
bash deploy/install.sh
```

El instalador te pedirá:
- **Dominio**: El dominio donde se servirá la app (ej: tickets.tudominio.com)
- **Email SSL**: Para el certificado Let's Encrypt
- **Puerto**: Puerto interno de Docker (default: 3080)
- **Directorio**: Donde se instalará la app (default: /opt/ticketzone)
- **Firewall**: Si deseas configurar UFW

### 4. ¡Listo!
Una vez completada la instalación, tu app estará disponible en:
- `https://tudominio.com` (con SSL)
- `http://tudominio.com` (sin SSL)

---

## Comandos de Gestión

Después de la instalación, puedes usar el comando `ticketzone`:

```bash
# Ver estado
ticketzone status

# Ver logs en tiempo real
ticketzone logs

# Reiniciar aplicación
ticketzone restart

# Reconstruir desde cero
ticketzone rebuild

# Detener aplicación
ticketzone stop

# Iniciar aplicación
ticketzone start

# Actualizar aplicación
ticketzone update

# Renovar certificado SSL
ticketzone ssl-renew
```

---

## Instalación Manual

Si prefieres instalar paso a paso:

### 1. Actualizar sistema
```bash
apt update && apt upgrade -y
```

### 2. Instalar Docker
```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
```

### 3. Instalar Nginx
```bash
apt install -y nginx
systemctl enable nginx
```

### 4. Instalar Certbot (SSL)
```bash
apt install -y certbot python3-certbot-nginx
```

### 5. Configurar Firewall
```bash
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 6. Copiar proyecto
```bash
mkdir -p /opt/ticketzone
cp -r /tmp/ticketzone/* /opt/ticketzone/
cd /opt/ticketzone
```

### 7. Construir y ejecutar
```bash
docker compose -f deploy/docker-compose.yml build
docker compose -f deploy/docker-compose.yml up -d
```

### 8. Configurar Nginx
Crear `/etc/nginx/sites-available/tudominio.com`:
```nginx
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;

    location / {
        proxy_pass http://127.0.0.1:3080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Habilitar sitio:
```bash
ln -s /etc/nginx/sites-available/tudominio.com /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

### 9. Configurar SSL
```bash
certbot --nginx -d tudominio.com -d www.tudominio.com
```

---

## Solución de Problemas

### La app no carga
```bash
# Ver estado del contenedor
docker ps -a

# Ver logs del contenedor
docker logs ticketzone-app

# Ver logs de Nginx
tail -f /var/log/nginx/error.log
```

### Error de build
```bash
# Limpiar todo y reconstruir
docker system prune -a
cd /opt/ticketzone
docker compose -f deploy/docker-compose.yml build --no-cache
docker compose -f deploy/docker-compose.yml up -d
```

### Puerto ocupado
```bash
# Ver qué usa el puerto
lsof -i :3080

# Cambiar puerto en docker-compose.yml y reiniciar
```

### Certificado SSL no funciona
```bash
# Verificar que el dominio apunta al servidor
dig tudominio.com

# Obtener certificado manualmente
certbot certonly --nginx -d tudominio.com

# Renovar certificado
certbot renew
```

### Firewall bloquea conexiones
```bash
# Ver reglas actuales
ufw status verbose

# Permitir puerto específico
ufw allow 80/tcp
ufw allow 443/tcp
```

---

## Archivos Importantes

| Archivo | Descripción |
|---------|-------------|
| `/opt/ticketzone/` | Directorio de la aplicación |
| `/etc/nginx/sites-available/` | Configuración de Nginx |
| `/var/log/nginx/` | Logs de Nginx |
| `/etc/systemd/system/ticketzone.service` | Servicio systemd |

---

## Actualización

Para actualizar la aplicación:

```bash
cd /opt/ticketzone
git pull  # Si usas git
ticketzone rebuild
```

O manualmente:
```bash
cd /opt/ticketzone
docker compose -f deploy/docker-compose.yml down
docker compose -f deploy/docker-compose.yml build --no-cache
docker compose -f deploy/docker-compose.yml up -d
```

---

## Backup

### Hacer backup
```bash
tar -czvf ticketzone-backup-$(date +%Y%m%d).tar.gz /opt/ticketzone
```

### Restaurar backup
```bash
tar -xzvf ticketzone-backup-YYYYMMDD.tar.gz -C /
ticketzone rebuild
```
