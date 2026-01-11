# 📦 Gestión de Productos del Sistema

Este documento explica cómo mantener los productos sincronizados con las funcionalidades reales del sistema.

## 🎯 Módulos Disponibles

El sistema cuenta con **9 módulos principales** definidos en `shared/schema.ts`:

| Módulo | Código | Descripción | Límites |
|--------|--------|-------------|---------|
| **Usuarios** | `USERS` | Gestión de usuarios y permisos | ✅ Hasta 5 por defecto |
| **Empresas** | `COMPANIES` | Gestión de empresas y contactos | ✅ Hasta 100 por defecto |
| **CRM** | `CRM` | Relaciones con clientes y oportunidades | ❌ Sin límites |
| **Facturación** | `BILLING` | Sistema de facturación y pagos | ❌ Sin límites |
| **Inventario** | `INVENTORY` | Gestión de productos e inventario | ✅ Hasta 1000 por defecto |
| **Recursos Humanos** | `HR` | Gestión de empleados | ✅ Hasta 50 por defecto |
| **Analíticas** | `ANALYTICS` | Reportes y analíticas avanzadas | ❌ Sin límites |
| **Reportes** | `REPORTS` | Generación de reportes personalizados | ❌ Sin límites |
| **Automatización** | `AUTOMATION` | Automatización de procesos | ✅ Hasta 10 por defecto |

## 🛠️ Scripts de Gestión

### Sincronizar Productos
```bash
# Elimina productos existentes y crea productos válidos
node server/migrate-sync-products.js
```

### Validar Productos
```bash
# Verifica que los productos estén alineados con el sistema
node server/validate-products.js
```

## 📋 Tipos de Productos

### 1. **Productos de Módulos** (`MODULE`)
- Un producto por cada módulo del sistema
- Precio base: $29.99 (con límites) / $39.99 (sin límites)
- Incluye acceso completo al módulo

### 2. **Usuarios Adicionales** (`USER_ADDON`)
- Permite agregar usuarios extra
- Precio: $5.99/mes por usuario adicional
- No relacionado a ningún módulo específico

### 3. **Funciones Adicionales** (`FEATURE_ADDON`)
- Funcionalidades premium dentro de un módulo
- Ejemplos: Analíticas Premium, Automatización Avanzada
- Precio variable según la funcionalidad

### 4. **Almacenamiento** (`STORAGE_ADDON`)
- Espacio de almacenamiento adicional
- Precio: $2.99/mes por 10GB adicionales
- Incluye backup automático y alta disponibilidad

## 🔍 Validación en el Sistema

### Interfaz Web
La página de gestión de planes muestra:
- **Estadísticas en tiempo real** de productos
- **Validación visual** con badges de colores:
  - 🟢 Verde: Módulo válido
  - 🔴 Rojo: Módulo no encontrado (❌)
- **Contadores** de módulos válidos vs total disponible

### Validaciones Automáticas
- Los productos de tipo `MODULE` deben tener un `moduleType` válido
- Los productos `FEATURE_ADDON` con `moduleType` deben referenciar un módulo existente
- Badges visuales indican problemas de alineación

## 🚨 Qué Hacer Si Hay Productos No Válidos

### 1. **Identificar Productos Problemáticos**
```bash
node server/validate-products.js
```
Buscar productos marcados con ❌

### 2. **Limpiar y Regenerar**
```bash
node server/migrate-sync-products.js
```
Esto eliminará todos los productos y los recreará correctamente

### 3. **Verificar en la Interfaz**
- Ve a **Plan Management** → **Productos Independientes**
- Verifica que todos los badges sean verdes
- Las estadísticas deben mostrar: **9/9 Módulos Válidos**

## 📊 Estructura de la Base de Datos

```sql
-- Tabla de productos
CREATE TABLE products (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type product_type NOT NULL, -- MODULE, USER_ADDON, FEATURE_ADDON, STORAGE_ADDON
  price DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  billing_frequency billing_frequency NOT NULL DEFAULT 'MONTHLY',
  module_type module_type, -- Referencia a AVAILABLE_MODULES
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata TEXT, -- JSON con features y configuración
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## ⚡ Mejores Prácticas

1. **Antes de agregar nuevos módulos:**
   - Actualizar `AVAILABLE_MODULES` en `shared/schema.ts`
   - Ejecutar el script de sincronización
   - Verificar que todo funcione correctamente

2. **Antes de eliminar módulos:**
   - Verificar que no haya planes activos usándolos
   - Actualizar productos relacionados
   - Ejecutar validación

3. **Monitoreo regular:**
   - Ejecutar validación mensualmente
   - Revisar la interfaz de gestión
   - Verificar que los precios sean consistentes

## 🎉 Estado Actual

✅ **Sistema completamente sincronizado**
- 9 productos de módulos creados
- 4 productos adicionales configurados
- Todos los productos alineados con el sistema
- Validación visual funcionando
- Scripts de mantenimiento listos

La gestión de productos está ahora completamente alineada con las funcionalidades reales del sistema.