# 🚀 Controly - Sistema de Gestión Empresarial

Un CRM moderno y completo para la gestión de empresas, clientes, oportunidades y actividades comerciales. Sistema profesional listo para producción con autenticación segura, dashboard ejecutivo y gestión completa de relaciones comerciales.

## ✨ Características

- **Gestión de Empresas**: Administra información completa de empresas y contactos
- **Pipeline de Ventas**: Kanban board para seguimiento de oportunidades
- **Gestión de Actividades**: Calendario y timeline de actividades comerciales
- **Usuarios y Permisos**: Sistema de roles y permisos granulares
- **Reportes**: Dashboard con métricas y estadísticas
- **Interfaz Moderna**: Diseño responsive con componentes UI modernos
- **Autenticación Segura**: Sistema de login con sesiones seguras
- **Base de Datos**: PostgreSQL con Supabase

## 🛠️ Tecnologías

### Frontend
- **React 18** - Framework de UI
- **TypeScript** - Tipado estático
- **Vite** - Build tool y dev server
- **Tailwind CSS** - Framework de estilos
- **Radix UI** - Componentes accesibles
- **React Hook Form** - Manejo de formularios
- **TanStack Query** - Gestión de estado del servidor

### Backend
- **Node.js** - Runtime de JavaScript
- **Express.js** - Framework web
- **TypeScript** - Tipado estático
- **JWT** - Autenticación basada en tokens
- **PostgreSQL** - Base de datos
- **Supabase** - Plataforma de base de datos
- **Drizzle ORM** - ORM moderno
- **bcrypt** - Hashing de contraseñas
- **Helmet** - Seguridad HTTP

### Deployment
- **Frontend**: Vercel (Configurado y funcionando)
- **Backend**: Railway (Configurado y funcionando)
- **Database**: Supabase (PostgreSQL)

## 🚀 Instalación y Configuración

### Prerrequisitos
- Node.js 18+ 
- Cuenta de Supabase (gratuita)
- Cuenta de Vercel para deployment (opcional)

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/controly.git
cd controly
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar Supabase
1. Crea un proyecto en [Supabase](https://supabase.com)
2. Ve a Settings > API y copia tu URL y anon key
3. Ve a Settings > Database y copia tu connection string

### 4. Configurar variables de entorno
```bash
cp env.example .env
```

Edita el archivo `.env` con tus configuraciones de Supabase:
```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
SESSION_SECRET=tu-secreto-super-seguro-de-64-caracteres-minimo
SUPER_ADMIN_EMAIL=admin@tuempresa.com
SUPER_ADMIN_PASSWORD=CambiaEstaContraseña123!
CORS_ORIGIN=http://localhost:5173,https://tudominio.com
```

### 5. Inicializar base de datos
```bash
# Aplicar esquemas a Supabase
npm run db:push
```

### 6. Iniciar en desarrollo
```bash
npm run dev
```

Accede a: http://localhost:5173

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Iniciar servidor de desarrollo
npm run build            # Construir para producción
npm run start            # Iniciar en producción

# Base de datos
npm run db:push          # Sincronizar esquema de BD
npm run setup:supabase   # Configurar Supabase
npm run verify:supabase  # Verificar conexión

# Utilidades
npm run check            # Verificar tipos TypeScript
npm run generate:secrets # Generar secretos seguros
```

## 🔐 Configuración de Seguridad

### Variables de Entorno Críticas
```bash
SESSION_SECRET=tu-super-secreto-seguro-de-64-caracteres
SUPER_ADMIN_PASSWORD=contraseña-segura-del-admin
CORS_ORIGIN=https://tudominio.com
```

### Generar Secretos Seguros
```bash
npm run generate:secrets
```

## 📦 Despliegue a Producción

Este proyecto está configurado para deployment distribuido:
- **Frontend**: Vercel
- **Backend**: Railway  
- **Base de datos**: Supabase

### Prerequisitos de Deployment
1. Cuenta de [Vercel](https://vercel.com) (para frontend)
2. Cuenta de [Railway](https://railway.app) (para backend)
3. Proyecto de [Supabase](https://supabase.com) (para base de datos)
4. Repositorio de GitHub con el código

### Frontend - Vercel

#### 1. Configuración de Vercel
1. Conecta tu repositorio en [Vercel](https://vercel.com)
2. **Root Directory**: `client`
3. **Framework**: Vite
4. **Build Command**: `npm ci && npm run build`
5. **Output Directory**: `dist` (automático)

#### 2. Variables de entorno en Vercel
```env
VITE_API_URL=https://tu-backend.up.railway.app
```

### Backend - Railway

#### 1. Configuración de Railway
1. Conecta tu repositorio en [Railway](https://railway.app)
2. El archivo `railway.json` se usa automáticamente
3. **Start Command**: `npm start`

#### 2. Variables de entorno en Railway
```env
# Base de datos
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
SUPABASE_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

# Seguridad
SESSION_SECRET=tu-secreto-super-seguro-64-chars
JWT_SECRET=otro-secreto-para-jwt-tokens
SUPER_ADMIN_EMAIL=admin@tuempresa.com
SUPER_ADMIN_PASSWORD=ContraseñaSegura123!

# CORS (incluir dominio de Vercel)
CORS_ORIGIN=https://tu-app.vercel.app,https://tudominio.com

# Configuración
NODE_ENV=production
PORT=8080
```

### Verificación del Deployment

#### Build local antes del deploy
```bash
# Frontend
cd client && npm run build

# Backend (verificar que compila)
npx tsx server/index.ts
```

### Variables de entorno críticas
- **Frontend**: `VITE_API_URL` debe apuntar a Railway
- **Backend**: `CORS_ORIGIN` debe incluir dominio de Vercel
- **Database**: `DATABASE_URL` de Supabase
- **Security**: `JWT_SECRET` y `SESSION_SECRET` únicos

## 📁 Estructura del Proyecto

```
Controly/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/     # Componentes reutilizables
│   │   ├── pages/         # Páginas de la aplicación
│   │   ├── hooks/         # Custom hooks
│   │   ├── lib/           # Utilidades y configuración
│   │   ├── contexts/      # Contextos de React
│   │   └── types/         # Tipos TypeScript frontend-only
│   │       └── schema.ts  # Schema sin dependencias drizzle-orm
│   └── index.html
├── server/                # Backend Express
│   ├── routes.ts          # Definición de rutas
│   ├── storage.ts         # Capa de datos
│   ├── middleware/        # Middlewares JWT, permisos, etc.
│   ├── services/          # Servicios (email, etc.)
│   └── utils/             # Utilidades del servidor
├── shared/                # Código compartido (solo backend)
│   ├── schema.ts          # Schema completo con drizzle-orm
│   └── theme-config.ts    # Configuración de tema
├── scripts/               # Scripts de utilidad
├── railway.json           # Configuración Railway
├── vercel.json.backup     # Configuración Vercel (backup)
└── client/vercel.json     # Configuración SPA routing para Vercel
```

## 🏗️ Arquitectura del Schema

**⚠️ IMPORTANTE**: Este proyecto usa una arquitectura de schema dual para evitar conflictos de dependencias.

### Schema Backend (`/shared/schema.ts`)
- **Ubicación**: `/shared/schema.ts`
- **Uso**: Server-side únicamente
- **Dependencias**: Incluye `drizzle-orm`, `drizzle-zod`
- **Contenido**: Definiciones completas de tablas, relaciones, y validaciones

### Schema Frontend (`client/src/types/schema.ts`)
- **Ubicación**: `client/src/types/schema.ts`
- **Uso**: Frontend únicamente
- **Dependencias**: Solo `zod` (sin drizzle-orm)
- **Contenido**: Tipos TypeScript, interfaces, y validaciones para formularios

### Configuración de Aliases
```ts
// client/vite.config.ts
resolve: {
  alias: {
    "@": resolve(__dirname, "src"),
    "@shared": resolve(__dirname, "src/types"), // Apunta al schema frontend
  },
}
```

### ¿Por qué esta arquitectura?
1. **Build separado**: Evita errores de `drizzle-orm` en builds de frontend
2. **Optimización**: Frontend no incluye dependencias innecesarias del backend
3. **Mantenimiento**: Cada parte usa solo lo que necesita
4. **Deployment**: Permite deployment distribuido (Vercel + Railway)

### Mantenimiento del Schema
⚠️ **Al modificar schemas**: Mantener ambos archivos sincronizados manualmente:
1. Actualizar `/shared/schema.ts` (backend)
2. Sincronizar cambios en `client/src/types/schema.ts` (frontend)
3. Verificar que `AVAILABLE_MODULES` tenga estructura completa con `name`, `type`, `defaultLimit`

## 🔑 Credenciales por Defecto

**Super Admin:**
- Email: `admin@yourcompany.com`
- Password: `CHANGE_THIS_PASSWORD`

**⚠️ IMPORTANTE:** Cambia estas credenciales inmediatamente después del primer despliegue.

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🛠️ Troubleshooting

### Errores Comunes en Deployment

#### Error: `drizzle-orm` not found en Vercel
**Síntoma**: Build falla con "Rollup failed to resolve import 'drizzle-orm'"
**Solución**: Verificar que `@shared` apunte a `client/src/types` y no a `/shared`

#### Error: Módulos sin nombres en plan-form
**Síntoma**: Los módulos aparecen en blanco en el formulario de planes
**Causa**: `AVAILABLE_MODULES` es array en lugar de objeto con propiedades
**Solución**: Usar `client/src/types/schema.ts` con estructura completa

#### Error: 401 en endpoints específicos
**Síntoma**: Algunos endpoints devuelven 401 mientras otros funcionan
**Causa**: `requireBusinessAccount` middleware no incluye `requireAuth`
**Solución**: Ya resuelto en la versión actual

#### Error: CORS en producción
**Síntoma**: Requests desde Vercel a Railway fallan por CORS
**Solución**: Agregar dominio de Vercel a `CORS_ORIGIN` en Railway

#### Error: 404 al hacer refresh en rutas
**Síntoma**: Error 404 cuando haces refresh en `/companies`, `/dashboard`, etc.
**Causa**: SPA routing no configurado en Vercel
**Solución**: `client/vercel.json` con rewrite rules (ya incluido)

### Comandos de Diagnóstico

```bash
# Verificar build frontend
cd client && npm run build

# Verificar tipos
npm run check

# Verificar conexión BD
curl https://tu-backend.railway.app/api/debug-db

# Verificar autenticación
curl -H "Authorization: Bearer TOKEN" https://tu-backend.railway.app/api/opportunities
```

## 🆘 Soporte

Si tienes problemas o preguntas:
- Abre un issue en GitHub
- Revisa la sección de Troubleshooting
- Contacta al equipo de desarrollo

## 🚀 Roadmap

- [ ] Integración con calendarios externos
- [ ] API REST completa
- [ ] Aplicación móvil
- [ ] Integración con sistemas de facturación
- [ ] Reportes avanzados
- [ ] Notificaciones push
- [ ] Integración con redes sociales

---

**Desarrollado con ❤️ por el equipo Controly**
