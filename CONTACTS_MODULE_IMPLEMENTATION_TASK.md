# Tarea: Implementación del Módulo de Contactos para BizFlowCRM

## Estado Actual
Estoy en **modo plan** analizando el sistema existente para implementar un módulo completo de gestión de contactos.

## Requerimientos del Usuario

### Funcionalidades Principales
1. **Módulo de contactos independiente** (separado del futuro módulo CRM)
2. **Tabla con paginación** en la lista principal
3. **Búsqueda por nombre, email, teléfono**
4. **Perfiles individuales con fotografía** (upload y actualización)
5. **Importar/exportar contactos** desde Excel/CSV
6. **Respeto a permisos** de usuario y limitaciones del plan
7. **Sin límites artificiales de tiempo** - solo límites del plan

### Restricciones Técnicas
- ✅ **Usar planes existentes** (no crear nuevos)
- ✅ **Integrar con sistema de permisos actual** (plan_modules, get_effective_permissions)
- ✅ **Límites basados en item_limit** de cada plan
- ✅ **Separar completamente de CRM** (serán módulos independientes)

## Análisis Realizado

### Sistema de Planes Existente (según migración 003)
```sql
-- Planes detectados con sus límites:
STARTER: 50 contactos
BASIC: 200 contactos  
PROFESSIONAL: 1000 contactos
ENTERPRISE: ilimitado (NULL)
```

### Sistema de Permisos Actual
- Tabla `plan_modules` con permisos CRUD por módulo
- Función `get_effective_permissions()` para validación
- `UnifiedPermissionService` en backend
- Módulo CONTACTS ya definido en schema con límite default de 100

### Estructura de Contactos Propuesta
```sql
contacts:
- id, name, email, phone, mobile
- company, position, address, city, country
- avatar (URL foto), notes, tags[]
- source (MANUAL, IMPORTED, API)
- business_account_id (multi-tenant)
- created_by, created_at, updated_at
- is_deleted, deleted_at (soft delete)
```

## Plan de Implementación

### 1. **Base de Datos**
- Crear tabla `contacts` con campos completos
- Índices para búsqueda rápida y performance
- Migración para agregar módulo CONTACTS a planes existentes

### 2. **Backend API**
- Endpoints RESTful completos con validación de permisos
- Importación/exportación Excel/CSV
- Upload de fotografías con redimensionado
- Validación de límites de plan en tiempo real

### 3. **Frontend**
- `/contacts` - Lista principal con DataTable paginada
- `/contacts/:id` - Perfil completo con foto
- `/contacts/import` - Página de importación masiva
- Componentes reutilizables y hooks específicos

### 4. **Características Avanzadas**
- Sistema de tags personalizado
- Búsqueda avanzada con filtros
- Analytics básicos de contactos
- Upselling inteligente al acercarse a límites

## Estado de la Tarea
- ✅ **Investigación completada**: Sistema de planes y permisos analizado
- ✅ **Plan documentado**: CONTACTS_MODULE_PLAN.md creado
- ⏳ **Esperando confirmación**: Plan final para comenzar implementación
- ❌ **No iniciado**: Desarrollo de código (esperando aprobación de plan)

## Próximos Pasos
1. Confirmar plan final con integración a sistema existente
2. Crear migración de base de datos para tabla contacts
3. Implementar endpoints de backend con validaciones
4. Desarrollar componentes de frontend
5. Testing y validación de permisos
6. Documentación de API y uso

---

**Fecha**: Enero 2026  
**Estado**: En Planificación  
**Prioridad**: Alta  
**Estimación**: 2-3 días de desarrollo completo