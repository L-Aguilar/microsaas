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
- **PostgreSQL** - Base de datos
- **Supabase** - Plataforma de base de datos
- **Drizzle ORM** - ORM moderno
- **bcrypt** - Hashing de contraseñas
- **Helmet** - Seguridad HTTP

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

### Despliegue en Vercel (Recomendado)

#### 1. Preparar el repositorio
```bash
# Verificar que no hay archivos sensibles
git status

# Agregar cambios
git add .
git commit -m "feat: Prepare for production deployment"
git push origin main
```

#### 2. Configurar Vercel
1. Ve a [Vercel](https://vercel.com) y conecta tu repositorio
2. Importa tu proyecto de GitHub
3. Configura las variables de entorno en Vercel Dashboard:

```env
DATABASE_URL=tu_url_de_supabase
SESSION_SECRET=tu_secreto_super_seguro
SUPER_ADMIN_EMAIL=admin@tuempresa.com
SUPER_ADMIN_PASSWORD=ContraseñaSegura123!
CORS_ORIGIN=https://tu-app.vercel.app
NODE_ENV=production
```

#### 3. Deploy automático
- Vercel detectará automáticamente la configuración
- El deploy se ejecutará automáticamente
- Tu app estará disponible en `https://tu-proyecto.vercel.app`

### Configuración adicional
```bash
# Verificar build local antes del deploy
npm run build

# Verificar que el proyecto funciona
npm run start
```

### Variables de entorno críticas
- `DATABASE_URL`: URL de conexión a Supabase
- `SESSION_SECRET`: Clave secreta para sesiones (64+ caracteres)
- `SUPER_ADMIN_PASSWORD`: Contraseña del administrador
- `CORS_ORIGIN`: Dominio de tu aplicación en producción

## 📁 Estructura del Proyecto

```
Controly/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/     # Componentes reutilizables
│   │   ├── pages/         # Páginas de la aplicación
│   │   ├── hooks/         # Custom hooks
│   │   ├── lib/           # Utilidades y configuración
│   │   └── contexts/      # Contextos de React
│   └── index.html
├── server/                # Backend Express
│   ├── routes.ts          # Definición de rutas
│   ├── storage.ts         # Capa de datos
│   ├── services/          # Servicios (email, etc.)
│   └── utils/             # Utilidades del servidor
├── shared/                # Código compartido
│   ├── schema.ts          # Esquemas de validación
│   └── theme-config.ts    # Configuración de tema
└── scripts/               # Scripts de utilidad
```

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

## 🆘 Soporte

Si tienes problemas o preguntas:
- Abre un issue en GitHub
- Revisa la documentación en `/docs`
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
