# BizFlowCRM

Sistema integral de gestión de negocios multi-tenant desarrollado con React, Node.js y PostgreSQL.

## 🚀 Descripción

BizFlowCRM es una plataforma SaaS completa que permite a las empresas gestionar usuarios, contactos y oportunidades de venta bajo un sistema robusto de permisos basado en planes de suscripción.

## ✨ Características Principales

- **Multi-tenancy**: Aislamiento completo entre empresas
- **Sistema de Permisos Granular**: Control por módulos (USERS, CONTACTS, CRM)
- **Autenticación Segura**: JWT + CSRF + Rate Limiting
- **Vista de Perfil Completa**: Métricas detalladas y logs de actividad
- **Gestión de Contactos**: CRM completo con seguimiento de oportunidades
- **Planes de Suscripción**: FREE, STARTER, BUSINESS, ENTERPRISE
- **Performance Optimizada**: Índices estratégicos para 1,500+ usuarios

## 🛠 Stack Tecnológico

- **Frontend**: React + TypeScript + Vite + TanStack Query + Wouter
- **Backend**: Node.js + Express.js + TypeScript
- **Base de Datos**: PostgreSQL (Supabase)
- **UI**: Tailwind CSS + shadcn/ui
- **Autenticación**: JWT con refresh tokens
- **Styling**: Responsive design con componentes reutilizables

## 📦 Instalación y Desarrollo

### Prerequisitos

- Node.js 18+
- npm o yarn
- Base de datos PostgreSQL (Supabase recomendado)

### Instalación

1. **Clonar el repositorio:**
```bash
git clone https://github.com/luisaguilar/BizFlowCRM.git
cd BizFlowCRM
```

2. **Instalar dependencias:**
```bash
npm run install:all
```

3. **Configurar variables de entorno:**
```bash
# Backend
cp .env.example .env
# Editar .env con tus configuraciones

# Frontend
cd client
cp .env.example .env
# Editar .env con la URL del backend
```

4. **Iniciar en desarrollo:**
```bash
# Terminal 1 - Backend (Puerto 8080)
npm run dev

# Terminal 2 - Frontend (Puerto 5173)
npm run dev:client
```

### Scripts Disponibles

- `npm run dev` - Servidor backend en desarrollo
- `npm run dev:client` - Cliente frontend en desarrollo
- `npm run build` - Build completo (backend + frontend)
- `npm run start:prod` - Servidor en modo producción
- `npm run install:all` - Instalar dependencias completas

## 🚀 Deployment

Ver [DEPLOYMENT.md](DEPLOYMENT.md) para instrucciones completas de deployment en Vercel + Railway.

### Quick Deploy

**Frontend (Vercel):**
- Conectar repo GitHub
- Root Directory: `client`
- Build Command: `npm run build`
- Variables: `VITE_API_BASE_URL`

**Backend (Railway):**
- Conectar repo GitHub
- Auto-detecta `Procfile`
- Variables de entorno según `.env.example`

## 🏗 Arquitectura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Database      │
│   (Vercel)      │◄──►│   (Railway)     │◄──►│   (Supabase)    │
│                 │    │                 │    │                 │
│ React + Vite    │    │ Express + TS    │    │ PostgreSQL      │
│ TanStack Query  │    │ JWT Auth        │    │ Row Level Sec   │
│ Tailwind UI     │    │ Rate Limiting   │    │ Auto Backups    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 Estructura del Proyecto

```
BizFlowCRM/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/    # Componentes UI
│   │   ├── pages/         # Páginas principales
│   │   ├── hooks/         # Hooks personalizados
│   │   └── lib/           # Utilidades
│   └── vercel.json        # Config Vercel
├── server/                # Backend Express
│   ├── middleware/        # Middlewares
│   ├── services/          # Lógica de negocio
│   ├── utils/             # Utilidades
│   └── routes.ts          # Rutas API
├── Procfile              # Config Railway
├── railway.toml          # Config Railway avanzada
└── DEPLOYMENT.md         # Guía de deployment
```

## 🔒 Características de Seguridad

- **JWT Security**: Tokens de corta duración + refresh tokens
- **CSRF Protection**: Protección integrada en todas las rutas
- **Rate Limiting**: Prevención de ataques de fuerza bruta
- **Row Level Security**: Aislamiento a nivel de base de datos
- **Audit Trail**: Logging completo de acciones críticas
- **Input Validation**: Validación robusta con Zod
- **Role-based Access**: Validación jerárquica de permisos

## ⚙️ Variables de Entorno

### Backend (.env)
```bash
SUPABASE_DATABASE_URL=postgresql://...
JWT_SECRET=32-character-secret
SESSION_SECRET=32-character-secret
SUPER_ADMIN_EMAIL=admin@domain.com
SUPER_ADMIN_PASSWORD=secure-password
BREVO_API_KEY=email-api-key
NODE_ENV=production
PORT=8080
```

### Frontend (.env)
```bash
VITE_API_BASE_URL=https://api-domain.com
VITE_APP_NAME=BizFlowCRM
```

## 🎯 Características Técnicas Avanzadas

### Performance
- **Índices de Base de Datos**: 3 índices críticos optimizados
- **Consultas Optimizadas**: 5-10x mejora en velocidad
- **Cache Inteligente**: TanStack Query con invalidación automática

### UX/UI
- **Routing Optimizado**: Rutas independientes sin conflictos
- **Vista de Perfil Completa**: Métricas, permisos y actividad
- **Formularios Inteligentes**: Validación en tiempo real
- **Responsive Design**: Mobile-first approach

### Sistema de Permisos
- **Granular por Módulos**: USERS, CONTACTS, CRM
- **Validación Unificada**: Frontend y backend sincronizados
- **Role Hierarchy**: SUPER_ADMIN > BUSINESS_ADMIN > USER

## 📄 Licencia

MIT License - ver [LICENSE](LICENSE) para detalles.

## 🤝 Contribución

1. Fork el proyecto
2. Crear feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add AmazingFeature'`)
4. Push a branch (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

## 📞 Soporte

- **Documentación**: [claude.md](claude.md)
- **Issues**: [GitHub Issues](https://github.com/luisaguilar/BizFlowCRM/issues)
- **Email**: support@bizflowcrm.com

---

**Versión**: 2.2 - Producción Lista con Routing Optimizado  
**Status**: ✅ Listo para Deployment  
**Deploy Targets**: Vercel (Frontend) + Railway (Backend)  
**Performance**: Optimizado para 120 empresas / 1,500+ usuarios