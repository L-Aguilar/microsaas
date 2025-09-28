# 🔐 Guía de Seguridad - ShimliAdmin

## ⚠️ ADVERTENCIA DE SEGURIDAD

Este documento contiene información crítica sobre la seguridad de la plataforma ShimliAdmin.

## 🚨 Problemas de Seguridad Identificados y Solucionados

### ✅ Problemas Resueltos:

1. **Contraseñas Hardcodeadas Eliminadas**
   - ❌ `create-admin.js` - ELIMINADO
   - ❌ `test-password.js` - ELIMINADO  
   - ❌ `test-supabase-endpoints.cjs` - ELIMINADO
   - ❌ `validate-supabase.cjs` - ELIMINADO
   - ❌ `quick-endpoint-test.cjs` - ELIMINADO
   - ❌ `reset-password.cjs` - ELIMINADO

2. **Sistema de Gestión de Contraseñas Seguro**
   - ✅ `scripts/secure-password-manager.js` - CREADO
   - ✅ Generación de contraseñas aleatorias seguras
   - ✅ Almacenamiento seguro con bcrypt (12 rounds)
   - ✅ Sin exposición de contraseñas en código

## 🛡️ Mejores Prácticas de Seguridad Implementadas

### 1. **Gestión de Contraseñas**
```bash
# Reseteo seguro de contraseñas
node scripts/secure-password-manager.js reset luis@sheilim.com

# Listar usuarios (sin contraseñas)
node scripts/secure-password-manager.js list

# Verificar usuario existe
node scripts/secure-password-manager.js verify admin@example.com
```

### 2. **Configuración de Variables de Entorno**
```bash
# .env (NO COMMITTEAR)
SESSION_SECRET=tu-super-secreto-sesion-minimo-32-caracteres
SUPER_ADMIN_PASSWORD=tu-contraseña-super-segura-minimo-16-caracteres
```

### 3. **Autenticación Segura**
- ✅ bcrypt con 12 rounds para hashing
- ✅ Sesiones seguras con PostgreSQL
- ✅ Cookies httpOnly y secure
- ✅ CSRF protection con sameSite: 'strict'

### 4. **Validación de Entrada**
- ✅ Zod schemas para validación
- ✅ Sanitización de datos
- ✅ Prevención de SQL injection con parámetros

## 🔧 Configuración de Seguridad Requerida

### Variables de Entorno Críticas:
```bash
# OBLIGATORIAS para producción
SESSION_SECRET=tu-super-secreto-sesion-minimo-32-caracteres
SUPER_ADMIN_PASSWORD=tu-contraseña-super-segura-minimo-16-caracteres
DATABASE_URL=tu-url-segura-de-base-de-datos

# OPCIONALES pero recomendadas
NODE_ENV=production
SERVE_FRONTEND=false
```

## 🚫 Lo que NO se debe hacer:

1. **NUNCA** committear archivos `.env` al repositorio
2. **NUNCA** usar contraseñas hardcodeadas en el código
3. **NUNCA** exponer contraseñas en logs o consola
4. **NUNCA** usar contraseñas débiles o predecibles
5. **NUNCA** almacenar contraseñas en texto plano

## ✅ Checklist de Seguridad para Producción:

- [ ] Variables de entorno configuradas correctamente
- [ ] SESSION_SECRET cambiado del valor por defecto
- [ ] SUPER_ADMIN_PASSWORD cambiado del valor por defecto
- [ ] HTTPS habilitado en producción
- [ ] Firewall configurado
- [ ] Logs de seguridad habilitados
- [ ] Backup de base de datos configurado
- [ ] Monitoreo de seguridad implementado

## 🆘 En caso de Compromiso:

1. **Inmediatamente** cambiar todas las contraseñas
2. **Revisar** logs de acceso
3. **Auditar** permisos de usuarios
4. **Notificar** a usuarios afectados
5. **Documentar** el incidente

## 📞 Contacto de Seguridad:

Para reportar vulnerabilidades de seguridad, contactar inmediatamente al equipo de desarrollo.

---

**Última actualización:** $(date)
**Versión:** 1.0.0

