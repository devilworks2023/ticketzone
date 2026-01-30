# TicketZone - Guía de Despliegue VPS

## Requisitos del Servidor

- **OS**: Ubuntu 20.04+, Debian 11+, CentOS 8+, o Rocky Linux
- **RAM**: Mínimo 1GB (recomendado 2GB)
- **CPU**: 1 vCPU mínimo
- **Disco**: 10GB libre
- **Puertos**: 80 (HTTP), 443 (HTTPS), 22 (SSH)

## Instalación Rápida

### Opción 1: Script Automático (Recomendado)

```bash
# 1. Sube el proyecto al servidor
scp -r ./* usuario@tu-servidor:/tmp/ticketzone/

# 2. Conecta al servidor
ssh usuario@tu-servidor

# 3. Ejecuta el instalador
cd /tmp/ticketzone
chmod +x deploy/install.sh
sudo ./deploy/install.sh
```

### Opción 2: Instalación Manual

```bash
# 1. Instala Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker

# 2. Clona/copia el proyecto
mkdir -p /opt/ticketzone
cd /opt/ticketzone
# Copia archivos aquí

# 3. Construye y ejecuta
docker-compose -f deploy/docker-compose.yml up -d --build
```

## Configuración SSL (HTTPS)

### Con Let's Encrypt

```bash
# 1. Instala certbot
apt install certbot -y

# 2. Obtén certificado
certbot certonly --standalone -d tudominio.com

# 3. Actualiza nginx-ssl.conf
sed -i 's/YOUR_DOMAIN.com/tudominio.com/g' deploy/nginx-ssl.conf

# 4. Usa config SSL
cp deploy/nginx-ssl.conf deploy/nginx.conf

# 5. Reconstruye
docker-compose -f deploy/docker-compose.yml up -d --build
```

## Comandos Útiles

```bash
# Ver estado
docker ps

# Ver logs en tiempo real
docker logs -f ticketzone-web

# Reiniciar aplicación
docker-compose -f deploy/docker-compose.yml restart

# Actualizar (después de cambios)
docker-compose -f deploy/docker-compose.yml up -d --build

# Detener
docker-compose -f deploy/docker-compose.yml down

# Ver uso de recursos
docker stats ticketzone-web
```

## Estructura de Archivos

```
deploy/
├── Dockerfile          # Imagen Docker
├── docker-compose.yml  # Orquestación
├── nginx.conf          # Config Nginx (HTTP)
├── nginx-ssl.conf      # Config Nginx (HTTPS)
├── install.sh          # Script instalación completa
├── quick-deploy.sh     # Despliegue rápido
└── DEPLOY.md           # Esta documentación
```

## Solución de Problemas

### El contenedor no inicia
```bash
docker logs ticketzone-web
```

### Puerto 80 ocupado
```bash
# Ver qué usa el puerto
lsof -i :80
# O cambiar puerto en docker-compose.yml
```

### Problemas de permisos
```bash
chmod +x deploy/*.sh
```

### Reconstruir desde cero
```bash
docker-compose -f deploy/docker-compose.yml down
docker system prune -af
docker-compose -f deploy/docker-compose.yml up -d --build
```

## Actualizaciones

```bash
cd /opt/ticketzone
# Actualiza archivos del proyecto
docker-compose -f deploy/docker-compose.yml up -d --build
```

## Backups

Los datos se almacenan en el navegador del usuario (localStorage).
Para un sistema completo de backups, considera añadir una base de datos.

---

## Instalación en Hestia Control Panel

Si usas Hestia CP, hay un script específico que automatiza todo:

```bash
# 1. Sube el proyecto al servidor
scp -r ./* usuario@tu-servidor:/tmp/ticketzone/

# 2. Conecta al servidor
ssh root@tu-servidor

# 3. Ejecuta el instalador de Hestia
cd /tmp/ticketzone
chmod +x deploy/install-hestia.sh
./deploy/install-hestia.sh
```

### ¿Qué hace el script de Hestia?

1. ✅ Verifica que Hestia esté instalado
2. ✅ Lista usuarios disponibles
3. ✅ Crea el dominio en Hestia automáticamente
4. ✅ Configura Nginx como proxy reverso
5. ✅ Instala Docker si no existe
6. ✅ Configura SSL con Let's Encrypt (opcional)
7. ✅ Crea servicio systemd para inicio automático
8. ✅ Genera script de gestión fácil de usar

### Comandos de gestión (Hestia)

```bash
# Ver estado
/home/USUARIO/web/DOMINIO/manage-ticketzone.sh status

# Ver logs
/home/USUARIO/web/DOMINIO/manage-ticketzone.sh logs

# Reiniciar
/home/USUARIO/web/DOMINIO/manage-ticketzone.sh restart

# Actualizar
/home/USUARIO/web/DOMINIO/manage-ticketzone.sh update
```
