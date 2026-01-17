# 🚀 BizFlowCRM - Guía de Despliegue en Producción

## Arquitectura de Despliegue

```
Frontend (Vercel) → Backend (Railway) → Database (Supabase)
```

## 1. Base de Datos - Supabase

### Configuración Inicial
1. Crear proyecto en [Supabase](https://app.supabase.com)
2. Obtener la URL de conexión desde Settings → Database
3. Ejecutar migraciones desde `server/migrations/` en orden:
   ```sql
   -- En el SQL Editor de Supabase:
   001_security_constraints.sql
   002_unified_permissions.sql
   003_fix_plan_modules_permissions.sql
   004_migrate_companies_to_contacts.sql
   ```

### Variables de Supabase
```bash
SUPABASE_DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

## 2. Backend - Railway

### Configuración del Proyecto
1. Conectar repositorio GitHub a Railway
2. Configurar variables de entorno en Railway Dashboard

### Variables de Entorno Requeridas
```bash
# Seguridad (CRÍTICO)
JWT_SECRET=your_32_char_jwt_secret_here
SESSION_SECRET=your_32_char_session_secret_here

# Base de Datos
SUPABASE_DATABASE_URL=your_supabase_url_here

# Email (Brevo)
BREVO_API_KEY=your_brevo_api_key
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=BizFlowCRM
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your_brevo_smtp_user
SMTP_PASS=your_brevo_smtp_password

# Super Admin
SUPER_ADMIN_EMAIL=admin@yourdomain.com
SUPER_ADMIN_PASSWORD=your_secure_password

# Aplicación
NODE_ENV=production
PORT=8080
BASE_URL=https://your-railway-domain.railway.app

# CORS
CORS_ORIGIN=https://your-vercel-domain.vercel.app
```

### Build Settings Railway
```json
{
  "build": {
    "command": "npm run build:server"
  },
  "start": {
    "command": "npm run start:server"
  }
}
```

## 3. Frontend - Vercel

### Configuración del Proyecto
1. Importar repositorio desde GitHub
2. Configurar como monorepo con directorio `client/`

### Build Settings Vercel
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "client/dist",
  "rootDirectory": "client",
  "framework": "vite"
}
```

### Variables de Entorno Vercel
```bash
# API Backend
VITE_API_URL=https://your-railway-domain.railway.app

# Aplicación
NODE_ENV=production
```

## 4. Dominios y DNS

### Configuración de Dominios
1. **Frontend**: Configurar dominio custom en Vercel
2. **Backend**: Configurar dominio custom en Railway (opcional)
3. **SSL**: Automático en ambas plataformas

### Actualizar CORS
Después de configurar dominios, actualizar en Railway:
```bash
CORS_ORIGIN=https://yourdomain.com
BASE_URL=https://api.yourdomain.com  # si usas subdominio
```

## 5. Scripts de Package.json

Verificar que existan estos scripts en el package.json raíz:

```json
{
  "scripts": {
    "build": "npm run build:client && npm run build:server",
    "build:client": "cd client && npm run build",
    "build:server": "cd server && npx tsc",
    "start": "npm run start:server",
    "start:server": "cd server && node dist/index.js",
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "cd server && npx tsx index.ts",
    "dev:client": "cd client && npm run dev"
  }
}
```

## 6. Verificación de Despliegue

### Checklist de Producción
- [ ] Supabase: Migraciones ejecutadas
- [ ] Railway: Variables de entorno configuradas
- [ ] Railway: Aplicación desplegada correctamente
- [ ] Vercel: Frontend desplegado y conectado al backend
- [ ] Dominios: SSL activo
- [ ] CORS: Configurado correctamente
- [ ] Autenticación: Login funcionando
- [ ] Permisos: UnifiedPermissionService operativo
- [ ] Email: Brevo configurado y enviando

### URLs de Verificación
```bash
# Backend Health Check
curl https://your-railway-domain.railway.app/api/health

# Frontend
curl https://your-vercel-domain.vercel.app

# Login Test
curl -X POST https://your-railway-domain.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourdomain.com","password":"your_password"}'
```

## 7. Monitoreo y Logs

### Railway Logs
```bash
# Ver logs en tiempo real
railway logs --follow
```

### Vercel Logs
- Dashboard → Functions → View Logs

### Supabase Monitoring
- Dashboard → Logs → Database logs

## 8. Actualizaciones

### Pipeline de Despliegue
1. Desarrollo → Push a GitHub
2. Railway: Auto-deploy backend
3. Vercel: Auto-deploy frontend
4. Verificar funcionamiento

### Rollback
- Railway: Deploy previous version
- Vercel: Revert to previous deployment

## 9. Seguridad en Producción

### Checklist de Seguridad
- [ ] JWT_SECRET fuerte (32+ chars)
- [ ] Credenciales de admin seguras
- [ ] CORS configurado correctamente
- [ ] HTTPS habilitado
- [ ] Variables de entorno no expuestas
- [ ] Rate limiting activo
- [ ] Logs de seguridad monitoreados

### Backup
- Supabase: Backups automáticos habilitados
- Código: Repositorio GitHub como backup

## Soporte

Para problemas de despliegue:
1. Verificar logs en Railway/Vercel
2. Verificar variables de entorno
3. Comprobar conectividad entre servicios
4. Revisar configuración de CORS

---

**Última actualización**: Enero 2026  
**Stack**: Vercel + Railway + Supabase  
**Status**: Listo para producción ✅