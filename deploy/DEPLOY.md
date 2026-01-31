# TicketZone - Guía de Despliegue

## Requisitos del Servidor

- **Sistema Operativo:** Ubuntu 24.04 LTS (recomendado)
- **RAM:** Mínimo 1GB (recomendado 2GB)
- **Disco:** Mínimo 10GB
- **Acceso:** Root o sudo

## Instalación Rápida

### 1. Subir archivos al servidor

```bash
# Opción A: Clonar desde repositorio
git clone https://tu-repositorio/ticketzone.git /tmp/ticketzone

# Opción B: Subir por SCP/SFTP a /tmp/ticketzone
```

### 2. Ejecutar instalador

```bash
cd /tmp/ticketzone/deploy
sudo bash install.sh
```

El instalador te pedirá:
- **Dominio:** ej: tickets.tudominio.com
- **Email SSL:** para certificado Let's Encrypt (opcional)
- **Puerto:** puerto interno Docker (default: 3080)
- **Directorio:** donde instalar (default: /opt/ticketzone)

## Estructura del Sistema

```
/opt/ticketzone/
├── app/                    # Frontend React Native Web
├── backend/                # Backend Node.js
│   └── server.js          # Servidor principal
├── deploy/                 # Archivos de despliegue
├── data/                   # Base de datos SQLite
│   └── ticketzone.db
└── ticketzone.sh          # Script de gestión
```

## Comandos de Gestión

```bash
# Estado de la aplicación
ticketzone status

# Ver logs en tiempo real
ticketzone logs

# Reiniciar aplicación
ticketzone restart

# Reconstruir desde cero
ticketzone rebuild

# Backup de base de datos
ticketzone db-backup

# Acceder a consola SQLite
ticketzone db-shell

# Renovar certificado SSL
ticketzone ssl-renew
```

## Base de Datos

El sistema usa **SQLite** para simplicidad y portabilidad.

### Tablas principales:

| Tabla | Descripción |
|-------|-------------|
| `events` | Eventos/fiestas |
| `ticket_tiers` | Tipos de entrada por evento |
| `tickets` | Entradas vendidas |
| `sellers` | Vendedores/RRPP |
| `seller_commissions` | Comisiones por vendedor |
| `promoters` | Promotores/organizadores |
| `promoter_payouts` | Pagos a promotores |
| `settings` | Configuración plataforma |
| `users` | Usuarios admin |

### Consultas útiles:

```sql
-- Ver total de ventas
SELECT SUM(price) as total FROM tickets;

-- Ver ventas por evento
SELECT e.name, COUNT(t.id) as vendidas, SUM(t.price) as total
FROM events e
LEFT JOIN tickets t ON e.id = t.event_id
GROUP BY e.id;

-- Ver top vendedores
SELECT name, code, total_sales, total_revenue
FROM sellers ORDER BY total_revenue DESC;
```

## API Backend

El backend expone una API tRPC en `/api/trpc`.

### Endpoints principales:

- `events.list` - Listar eventos
- `events.create` - Crear evento
- `tickets.create` - Vender entrada
- `tickets.validate` - Validar entrada
- `sellers.list` - Listar vendedores
- `promoters.list` - Listar promotores
- `stats.dashboard` - Estadísticas generales

### Health Check:

```bash
curl http://localhost/api/health
# Respuesta: {"status":"healthy","timestamp":"..."}
```

## SSL/HTTPS

### Configurar SSL manualmente:

```bash
certbot --nginx -d tudominio.com -m tu@email.com --agree-tos
```

### Renovar certificado:

```bash
ticketzone ssl-renew
# o
certbot renew
```

## Backups

### Backup automático (cron):

```bash
# Editar crontab
crontab -e

# Añadir línea para backup diario a las 3:00 AM
0 3 * * * /opt/ticketzone/ticketzone.sh db-backup
```

### Restaurar backup:

```bash
# Detener aplicación
ticketzone stop

# Copiar backup
cp /opt/ticketzone/backups/ticketzone_FECHA.db /opt/ticketzone/data/ticketzone.db

# Iniciar aplicación
ticketzone start
```

## Funcionalidades Futuras

### Pagos con Stripe Connect

El sistema está preparado para integrar Stripe Connect, permitiendo:
- Pagos directos a promotores
- Comisiones automáticas
- Dashboard de ganancias por promotor

Para activar, contacta para configurar las claves de Stripe.

### Campos preparados:

- `promoters.stripe_account_id` - ID cuenta Stripe del promotor
- `promoters.stripe_account_status` - Estado de la cuenta
- `tickets.payment_intent_id` - ID del pago en Stripe
- `promoter_payouts` - Registro de transferencias

## Solución de Problemas

### La aplicación no responde

```bash
# Ver logs
ticketzone logs

# Reiniciar
ticketzone restart

# Si persiste, reconstruir
ticketzone rebuild
```

### Error de base de datos

```bash
# Verificar permisos
ls -la /opt/ticketzone/data/

# Verificar integridad
sqlite3 /opt/ticketzone/data/ticketzone.db "PRAGMA integrity_check;"
```

### Nginx no funciona

```bash
# Verificar configuración
nginx -t

# Ver logs
tail -f /var/log/nginx/error.log

# Reiniciar
systemctl restart nginx
```

## Contacto

Para soporte técnico o activar funcionalidades premium como pagos con Stripe, contacta al desarrollador.
