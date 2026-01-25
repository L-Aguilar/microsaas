# BizFlowCRM - Guía de Deployment

## Arquitectura de Producción

- **Frontend**: Vercel (React + Vite)
- **Backend**: Railway (Node.js + Express.js)
- **Base de Datos**: Supabase (PostgreSQL)

## Deployment Frontend (Vercel)

### 1. Preparar el proyecto
```bash
# En la carpeta client/
npm install
npm run build
```

### 2. Configurar Vercel
1. Conectar repositorio de GitHub a Vercel
2. Configurar proyecto:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
   - **Root Directory**: `client`

### 3. Variables de Entorno en Vercel
```
VITE_API_BASE_URL=https://your-railway-app.railway.app
VITE_APP_NAME=BizFlowCRM
```

## Deployment Backend (Railway)

### 1. Preparar el proyecto
```bash
# En la raíz del proyecto
npm install
npm run build
```

### 2. Configurar Railway
1. Conectar repositorio de GitHub a Railway
2. Railway detectará automáticamente el `Procfile`
3. El proyecto usará el comando: `npm run start:prod`

### 3. Variables de Entorno en Railway
```bash
# Base de Datos
SUPABASE_DATABASE_URL=postgresql://user:password@host:port/database

# Seguridad (generar con: openssl rand -hex 32)
JWT_SECRET=your-32-character-secret
SESSION_SECRET=your-32-character-secret

# Admin Configuration
SUPER_ADMIN_EMAIL=admin@bizflowcrm.com
SUPER_ADMIN_PASSWORD=your-secure-password

# Email Service
BREVO_API_KEY=your-brevo-api-key
FROM_EMAIL=noreply@bizflowcrm.com

# Application
NODE_ENV=production
PORT=8080
```

### 4. Configuración de Dominio
Actualizar `VITE_API_BASE_URL` en Vercel con la URL de Railway una vez desplegado.

## Base de Datos (Supabase)

### Configuración inicial
1. Las migraciones se ejecutan automáticamente al iniciar el servidor
2. El super admin se crea automáticamente si no existe
3. Los planes base se inicializan automáticamente

### Índices críticos (ya implementados)
- `idx_users_business_account_fast`
- `idx_user_permissions_fast_lookup`
- `idx_users_email_fast_login`

## Health Checks

El backend incluye endpoints de salud:
- `GET /api/health` - Estado general del sistema
- Railway está configurado para usar este endpoint para health checks

## Logs y Monitoreo

- **Frontend**: Logs automáticos en Vercel Dashboard
- **Backend**: Logs estructurados con winston en Railway
- **Database**: Monitoring en Supabase Dashboard
- **Security**: Audit trail completo con secureLogger

## Troubleshooting

### Problemas comunes
1. **CORS Errors**: Verificar que `VITE_API_BASE_URL` apunte a la URL correcta de Railway
2. **Database Connection**: Verificar `SUPABASE_DATABASE_URL` en Railway
3. **JWT Errors**: Asegurar que `JWT_SECRET` tenga al menos 32 caracteres
4. **Build Failures**: Verificar que todas las dependencias estén en `package.json`

### Comandos de debug
```bash
# Local development
npm run dev:client  # Frontend en puerto 5173
npm run dev         # Backend en puerto 8080

# Production builds
npm run build:client  # Build frontend
npm run start:prod    # Start backend in production mode
```

## Seguridad en Producción

### Variables de Entorno Críticas
- Nunca subir archivos `.env` al repositorio
- Usar secretos fuertes (32+ caracteres)
- Configurar CORS apropiadamente
- Mantener dependencias actualizadas

### Backups
- Supabase: Backups automáticos diarios
- Código: Repositorio en GitHub como backup
- Configuración: Variables de entorno documentadas

## Scripts de Deployment

```json
{
  "build": "tsc && npm run build:client",
  "build:client": "cd client && npm run build",
  "start:prod": "NODE_ENV=production npx tsx server/index.ts",
  "install:all": "npm install && cd client && npm install"
}
```