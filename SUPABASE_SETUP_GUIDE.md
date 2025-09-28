# 🚀 Guía Rápida de Configuración de Supabase

## 📋 Pasos para Configurar Supabase

### 1. Crear cuenta en Supabase
1. Ve a [supabase.com](https://supabase.com)
2. Haz clic en "Start your project"
3. Crea una cuenta o inicia sesión

### 2. Crear nuevo proyecto
1. Haz clic en "New Project"
2. Elige tu organización
3. Configura tu proyecto:
   - **Name**: BizFlowCRM
   - **Database Password**: Usa una contraseña segura (guárdala)
   - **Region**: Elige la más cercana a tu ubicación
4. Haz clic en "Create new project"

### 3. Obtener credenciales de conexión
1. Ve a **Settings** > **Database**
2. En la sección "Connection string", copia la URL de **URI**
3. La URL será algo como:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.abcdefghijklmnop.supabase.co:5432/postgres
   ```

### 4. Actualizar archivo .env
1. Abre tu archivo `.env`
2. Reemplaza las líneas de DATABASE_URL y SUPABASE_DATABASE_URL:
   ```bash
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
   SUPABASE_DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
   ```
3. Sustituye `[YOUR-PASSWORD]` por tu contraseña real
4. Sustituye `[YOUR-PROJECT-REF]` por tu referencia de proyecto

### 5. Configurar esquema de base de datos
```bash
# Ejecutar setup de Supabase
npm run setup:supabase

# Verificar conexión
npm run verify:supabase
```

### 6. Iniciar la aplicación
```bash
# Iniciar servidor de desarrollo
npm run dev
```

## ✅ Verificación de Configuración

La aplicación debería:
1. ✅ Conectarse a Supabase sin errores
2. ✅ Crear las tablas automáticamente
3. ✅ Mostrar el mensaje "✓ Super Admin created in Supabase"
4. ✅ Ejecutarse en http://localhost:5000

## 🔑 Credenciales de Acceso Iniciales

Una vez configurado, puedes acceder con:
- **Email**: admin@bizflowcrm.com
- **Password**: SecureAdmin2024!@#BizFlow

## 🔧 Solución de Problemas

### Error de conexión
- Verifica que la URL de la base de datos sea correcta
- Asegúrate de que la contraseña no tenga caracteres especiales sin escape
- Verifica que el proyecto de Supabase esté activo

### Tablas no creadas
- Ejecuta: `npm run setup:supabase` manualmente
- Revisa los logs para errores específicos

### Puerto en uso
- Cambia el puerto en `.env`: `PORT=3001`
- O mata el proceso: `lsof -ti:5000 | xargs kill -9`

## 🎯 Próximos Pasos

1. **Accede a la aplicación**: http://localhost:5000
2. **Inicia sesión** con las credenciales de Super Admin
3. **Crea tu primera empresa** (Business Account)
4. **Añade usuarios** y configura módulos
5. **¡Explora todas las funcionalidades!**

## 🔐 Seguridad en Producción

Para producción, recuerda:
- [ ] Cambiar credenciales del Super Admin
- [ ] Configurar CORS_ORIGIN con tu dominio real
- [ ] Usar HTTPS
- [ ] Configurar backup de base de datos
- [ ] Monitorear accesos y logs