# TicketZone - Guía de Despliegue Completa

## Servidor
- **IP**: 82.223.44.155
- **OS**: Ubuntu 22.04
- **Panel**: Hestia Control Panel
- **Dominio**: tickets.devil-works.com

---

## PASO 1: Instalar Hestia (si no está instalado)

```bash
# Conectar al servidor
ssh root@82.223.44.155

# Descargar e instalar Hestia
wget https://raw.githubusercontent.com/hestiacp/hestiacp/release/install/hst-install.sh
bash hst-install.sh --apache no --phpfpm yes --multiphp no --vsftpd no --proftpd no --named yes --mysql yes --postgresql no --exim no --dovecot no --sieve no --clamav no --spamassassin no --iptables yes --fail2ban yes --quota no --hostname server.example.com --email tu@email.com --password TuPasswordSegura --lang es

# Reiniciar después de instalar
reboot
```

---

## PASO 2: Crear Usuario y Dominio en Hestia

```bash
# Conectar de nuevo
ssh root@82.223.44.155

# Crear usuario (si no existe)
v-add-user tiri TuPassword123! tu@email.com

# Crear dominio
v-add-domain tiri tickets.devil-works.com

# Verificar que se creó
ls -la /home/tiri/web/tickets.devil-works.com/
```

---

## PASO 3: Instalar Docker

```bash
# Instalar dependencias
apt update
apt install -y ca-certificates curl gnupg lsb-release

# Añadir repositorio Docker
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verificar instalación
docker --version
docker compose version

# Iniciar Docker
systemctl enable docker
systemctl start docker
```

---

## PASO 4: Clonar Proyecto desde Git

```bash
# Ir al directorio del dominio
cd /home/tiri/web/tickets.devil-works.com

# Crear directorio para Docker
mkdir -p docker
cd docker

# Clonar repositorio (reemplaza con tu repo)
git clone https://github.com/TU_USUARIO/TU_REPO.git .

# O si ya tienes los archivos, súbelos con scp desde tu máquina local:
# scp -r ./deploy/* root@82.223.44.155:/home/tiri/web/tickets.devil-works.com/docker/
```

---

## PASO 5: Construir y Ejecutar Docker

```bash
cd /home/tiri/web/tickets.devil-works.com/docker

# Construir imagen
docker compose -f deploy/docker-compose.yml build

# Ejecutar contenedor
docker compose -f deploy/docker-compose.yml up -d

# Verificar que está corriendo
docker ps

# Ver logs (para verificar que funciona)
docker logs ticketzone-web
```

---

## PASO 6: Configurar Nginx de Hestia como Proxy

```bash
# Editar configuración del dominio
nano /etc/nginx/conf.d/domains/tickets.devil-works.com.conf
```

**Reemplazar TODO el contenido con:**

```nginx
server {
    listen      82.223.44.155:80;
    server_name tickets.devil-works.com;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
```

```bash
# Verificar configuración
nginx -t

# Si dice "syntax is ok", reiniciar nginx
systemctl restart nginx

# Verificar que funciona
curl http://localhost:3000
curl http://tickets.devil-works.com
```

---

## PASO 7: Configurar SSL con Let's Encrypt

```bash
# Usar Hestia para generar SSL
v-add-letsencrypt-domain tiri tickets.devil-works.com

# Esperar unos segundos y verificar
v-list-web-domain tiri tickets.devil-works.com

# Si el SSL no se aplica automáticamente, editar config SSL manualmente:
nano /etc/nginx/conf.d/domains/tickets.devil-works.com.ssl.conf
```

**Contenido para el archivo SSL:**

```nginx
server {
    listen      82.223.44.155:443 ssl http2;
    server_name tickets.devil-works.com;

    ssl_certificate     /home/tiri/conf/web/tickets.devil-works.com/ssl/tickets.devil-works.com.pem;
    ssl_certificate_key /home/tiri/conf/web/tickets.devil-works.com/ssl/tickets.devil-works.com.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
```

```bash
# Verificar y reiniciar
nginx -t && systemctl restart nginx

# Probar HTTPS
curl https://tickets.devil-works.com
```

---

## PASO 8: Crear Servicio Systemd (Auto-inicio)

```bash
# Crear archivo de servicio
nano /etc/systemd/system/ticketzone.service
```

**Contenido:**

```ini
[Unit]
Description=TicketZone Docker Container
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/tiri/web/tickets.devil-works.com/docker
ExecStart=/usr/bin/docker compose -f deploy/docker-compose.yml up -d
ExecStop=/usr/bin/docker compose -f deploy/docker-compose.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

```bash
# Habilitar servicio
systemctl daemon-reload
systemctl enable ticketzone
systemctl start ticketzone

# Verificar estado
systemctl status ticketzone
```

---

## Comandos Útiles

```bash
# Ver estado del contenedor
docker ps

# Ver logs en tiempo real
docker logs -f ticketzone-web

# Reiniciar aplicación
cd /home/tiri/web/tickets.devil-works.com/docker
docker compose -f deploy/docker-compose.yml restart

# Actualizar después de cambios en el código
cd /home/tiri/web/tickets.devil-works.com/docker
git pull
docker compose -f deploy/docker-compose.yml up -d --build

# Detener todo
docker compose -f deploy/docker-compose.yml down

# Reconstruir desde cero
docker compose -f deploy/docker-compose.yml down
docker system prune -af
docker compose -f deploy/docker-compose.yml up -d --build
```

---

## Solución de Problemas

### Error: "duplicate location"
```bash
# Ver archivos de config del dominio
ls -la /etc/nginx/conf.d/domains/tickets.devil-works.com*

# Asegúrate de que solo hay UN bloque location / en cada archivo
# Elimina cualquier duplicado
```

### Error: SSL self-signed
```bash
# Regenerar SSL con Hestia
v-delete-letsencrypt-domain tiri tickets.devil-works.com
v-add-letsencrypt-domain tiri tickets.devil-works.com

# Verificar que los certificados existen
ls -la /home/tiri/conf/web/tickets.devil-works.com/ssl/
```

### Contenedor no arranca
```bash
docker logs ticketzone-web
```

### Puerto 3000 ocupado
```bash
lsof -i :3000
# Matar proceso si es necesario
kill -9 PID
```

### Nginx no arranca
```bash
# Ver error exacto
nginx -t

# Ver logs
journalctl -xeu nginx.service --no-pager | tail -50
```

---

## Resumen de Rutas Importantes

| Descripción | Ruta |
|-------------|------|
| Proyecto Docker | `/home/tiri/web/tickets.devil-works.com/docker/` |
| Config Nginx HTTP | `/etc/nginx/conf.d/domains/tickets.devil-works.com.conf` |
| Config Nginx HTTPS | `/etc/nginx/conf.d/domains/tickets.devil-works.com.ssl.conf` |
| Certificados SSL | `/home/tiri/conf/web/tickets.devil-works.com/ssl/` |
| Logs Docker | `docker logs ticketzone-web` |
| Servicio Systemd | `/etc/systemd/system/ticketzone.service` |
