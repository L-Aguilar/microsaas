# Plan de Implementación: Módulo de Contacts Completo para BizFlowCRM

## 🎯 Objetivo
Completar el módulo de Contacts con todas las funcionalidades requeridas, respetando el sistema de permisos granulares existente.

## 📋 Permisos por Rol Definidos

### SUPER_ADMIN
- ✅ Ve contactos de TODAS las empresas desde perfil de empresa
- ✅ Gestión completa del sistema
- ✅ Acceso administrativo total

### BUSINESS_ADMIN  
- ✅ Gestiona TODOS los contactos de su empresa
- ✅ Puede eliminar contactos creados por otros usuarios de su empresa
- ✅ Autoridad absoluta dentro de su empresa
- ✅ Asigna permisos granulares a usuarios

### USER
- ✅ Solo ve contactos de su empresa
- ✅ Acciones basadas en permisos granulares asignados por BUSINESS_ADMIN:
  - `can_view` - Puede ver contactos
  - `can_create` - Puede crear contactos  
  - `can_edit` - Puede editar contactos
  - `can_delete` - Puede eliminar contactos

### Import/Export
- ✅ Disponible solo para usuarios con permiso `can_create`
- ✅ Aplica para BUSINESS_ADMIN y USER con permisos

## ⚙️ Validaciones de Negocio Confirmadas

### Campos Obligatorios
- ✅ **Email Y teléfono**: Ambos campos son obligatorios
- ✅ **Nombre**: Campo obligatorio

### Duplicados
- ✅ **Email/teléfono únicos por empresa**: Prevenir duplicados dentro de la misma business_account
- ✅ **Validación en tiempo real**: Feedback inmediato al usuario

### Límites de Plan
- ✅ **Advertencias inteligentes**: Mostrar warning cuando se exceden límites
- ✅ **Invitación a upgrade**: Call-to-action para mejorar plan
- ✅ **No bloquear**: Permitir que BUSINESS_ADMIN decida
- ✅ **Aplica a import masivo**: Sistema de advertencias en importaciones

## 🗄️ Estructura de Base de Datos Extendida

### Tabla: contacts (migración de companies)
```sql
contacts:
- id (UUID, PK)
- name (TEXT, NOT NULL) 
- email (TEXT, NOT NULL, UNIQUE per business_account)
- phone (TEXT, NOT NULL, UNIQUE per business_account)
- mobile (TEXT, OPTIONAL)
- company (TEXT, OPTIONAL) 
- position (TEXT, OPTIONAL)
- address (TEXT, OPTIONAL)
- city (TEXT, OPTIONAL)
- country (TEXT, OPTIONAL)
- avatar (TEXT, URL to image)
- notes (TEXT, OPTIONAL)
- tags (TEXT[], ARRAY)
- source (ENUM: MANUAL, IMPORTED, API)
- business_account_id (UUID, FK, NOT NULL)
- created_by (UUID, FK to users)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- is_deleted (BOOLEAN, DEFAULT false)
- deleted_at (TIMESTAMP, NULL)
```

### Índices Necesarios
```sql
-- Búsqueda rápida
CREATE INDEX idx_contacts_search ON contacts(name, email, phone, company);
-- Constraintes únicos por empresa
CREATE UNIQUE INDEX idx_contacts_email_per_business ON contacts(email, business_account_id) WHERE is_deleted = false;
CREATE UNIQUE INDEX idx_contacts_phone_per_business ON contacts(phone, business_account_id) WHERE is_deleted = false;
-- Performance
CREATE INDEX idx_contacts_business_account ON contacts(business_account_id);
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);
```

## 🚀 Plan de Implementación por Fases

### Fase 1: Base de Datos (30 min)
1. **Migración de esquema**
   - Renombrar tabla companies → contacts  
   - Agregar campos: mobile, company, position, address, city, country, avatar, notes, tags, source, is_deleted, deleted_at
   - Crear índices únicos y de búsqueda
   - Migrar datos existentes

2. **Validaciones de BD**
   - Constraints únicos por business_account
   - Validaciones de campos obligatorios
   - Soft delete implementado

### Fase 2: Backend APIs (45 min)
3. **Extender endpoints existentes**
   - Actualizar /api/contacts (renombrado de /api/companies)
   - Agregar validación de campos únicos
   - Implementar soft delete
   - Validaciones de permisos granulares

4. **Upload de avatars**
   - Endpoint POST /api/contacts/:id/avatar
   - Redimensionado automático (150x150, 300x300)
   - Validaciones de formato (jpg, png, webp)
   - Storage optimizado

5. **Import/Export CSV**
   - POST /api/contacts/import (validación de permisos can_create)
   - GET /api/contacts/export (con filtros)
   - Sistema de advertencias para límites de plan
   - Validación de duplicados en import
   - Reporte de errores por fila

6. **Búsqueda avanzada**
   - GET /api/contacts/search?q=&filters=
   - Filtros: name, email, phone, company, tags, source
   - Paginación optimizada
   - Debounce en frontend

### Fase 3: Frontend Integrado (60 min)
7. **Actualizar formulario de contactos**
   - Todos los campos nuevos con validaciones
   - Validación única email/teléfono en tiempo real
   - Autocompletado para company/position
   - Tags con selector múltiple

8. **Componente de upload de avatar**
   - Drag & drop con preview
   - Crop/resize en frontend
   - Progress bar y validaciones
   - Fallback a initials/placeholder

9. **Página de Import/Export**
   - Upload de CSV con validación
   - Preview de datos antes de confirmar
   - Modal de advertencias de límites
   - Download template CSV
   - Reporte de errores post-import

10. **Búsqueda avanzada**
    - Input con filtros múltiples
    - Búsqueda en tiempo real (debounced)
    - Filtros por tags, empresa, fuente
    - Guardado de búsquedas frecuentes

11. **Papelera de contactos**
    - Vista de contactos eliminados
    - Restauración individual/masiva  
    - Eliminación permanente (solo BUSINESS_ADMIN)
    - Filtros por fecha de eliminación

12. **UI adaptativa por permisos**
    - Botones condicionalmente visibles
    - Tooltips explicativos para restricciones
    - Mensajes de upgrade cuando aplique
    - Formularios adaptados a permisos

### Fase 4: UX y Validaciones Finales (30 min)
13. **Sistema de advertencias inteligente**
    - Modal de límites de plan con pricing
    - Contador visual de uso vs límite
    - Call-to-action para upgrade
    - Tracking de conversiones

14. **Validaciones completas**
    - Email/teléfono únicos con feedback
    - Validación de formato de campos
    - Loading states para todas las operaciones
    - Error handling descriptivo

15. **Testing por roles**
    - SUPER_ADMIN: Vista de todas las empresas
    - BUSINESS_ADMIN: Gestión completa + permisos  
    - USER: Interfaz basada en permisos específicos
    - Edge cases y validaciones

## 📊 Funcionalidades Finales

### Core Features ✅
- ✅ CRUD completo con permisos granulares
- ✅ Soft delete con papelera
- ✅ Upload de avatars optimizado
- ✅ Import/Export CSV inteligente
- ✅ Búsqueda avanzada multi-campo
- ✅ Validaciones únicas por empresa
- ✅ Sistema de tags personalizable

### Business Features ✅  
- ✅ Límites de plan con advertencias
- ✅ Modal de upgrade integrado
- ✅ Permisos granulares por usuario
- ✅ Audit trail de acciones
- ✅ Multi-tenancy seguro

### UX Features ✅
- ✅ Interfaz adaptativa por rol
- ✅ Loading states y feedback
- ✅ Validaciones en tiempo real  
- ✅ Error handling descriptivo
- ✅ Mobile responsive

## ⏱️ Estimación de Tiempo
**Total: 2.5-3 horas de desarrollo completo**
- Base de Datos: 30 min
- Backend: 45 min  
- Frontend: 60 min
- UX/Testing: 30 min

## 🎯 Resultado Final
Módulo profesional de gestión de contactos completamente integrado con el sistema existente de BizFlowCRM, respetando arquitectura de permisos, planes y multi-tenancy.