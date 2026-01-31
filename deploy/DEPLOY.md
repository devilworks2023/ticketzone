# TicketZone - Guía de Despliegue en Hestia VPS

## Requisitos
- VPS con Hestia Control Panel
- Docker instalado
- Git instalado

## Instalación Paso a Paso

### 1. Conectar al servidor
```bash
ssh root@82.223.44.155
```

### 2. Instalar Docker (si no está instalado)
```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
```

### 3. Preparar el directorio
```bash
# Limpiar directorio existente
cd /home/tiri/web/tickets.devil-works.com/public_html
rm -rf * .[^.]*

# Clonar el repositorio
git clone https://github.com/devilworks2023/ticketzone.git .
```

### 4. Desplegar la aplicación
```bash
# Ejecutar script de despliegue
chmod +x deploy/deploy.sh
bash deploy/deploy.sh
```

O manualmente:
```bash
cd /home/tiri/web/tickets.devil-works.com/public_html/deploy
docker compose up -d --build
```

### 5. Verificar que funciona
```bash
# Ver contenedores
docker ps

# Ver logs
docker logs ticketzone-web

# Probar localmente
curl http://localhost:3080
```

### 6. Configurar Hestia Proxy

En Hestia Panel:
1. Ir a **WEB** > **tickets.devil-works.com**
2. Editar dominio
3. En **Proxy Template** seleccionar: `default`
4. En **Proxy Extensions**: Activar proxy
5. Agregar configuración personalizada:

Crear archivo `/home/tiri/conf/web/tickets.devil-works.com/nginx.conf_proxy`:
```nginx
location / {
    proxy_pass http://127.0.0.1:3080;
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
```

Reiniciar nginx:
```bash
systemctl restart nginx
```

## Comandos Útiles

```bash
# Ver estado
docker ps

# Ver logs en tiempo real
docker logs -f ticketzone-web

# Reiniciar contenedor
docker restart ticketzone-web

# Parar contenedor
docker stop ticketzone-web

# Actualizar aplicación
cd /home/tiri/web/tickets.devil-works.com/public_html
git pull
cd deploy
docker compose up -d --build

# Limpiar imágenes antiguas
docker image prune -f
```

## Solución de Problemas

### Error: "port already in use"
```bash
# Ver qué usa el puerto 3080
lsof -i :3080

# Matar proceso si es necesario
docker stop ticketzone-web
docker rm ticketzone-web
```

### Error de build
```bash
# Limpiar todo y reconstruir
docker system prune -a
cd /home/tiri/web/tickets.devil-works.com/public_html/deploy
docker compose build --no-cache
docker compose up -d
```

### Ver logs de error
```bash
docker logs ticketzone-web 2>&1 | tail -100
```
