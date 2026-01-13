# 🚀 Checklist de Deployment - Localhost a Producción

## ✅ Pre-Deployment - Verificaciones Locales

### 1. **Schema Synchronization**
- [ ] `client/src/types/schema.ts` existe y está actualizado
- [ ] `AVAILABLE_MODULES` tiene estructura completa (`name`, `type`, `defaultLimit`)
- [ ] Alias `@shared` en `client/vite.config.ts` apunta a `src/types`
- [ ] No hay imports de `drizzle-orm` en el frontend

### 2. **Build Verification**
```bash
# Frontend build debe funcionar
cd client && npm run build

# Backend no requiere build pero debe iniciar
npm run server
```

### 3. **Functionality Tests**
- [ ] Login funciona correctamente
- [ ] JWT tokens se guardan en localStorage
- [ ] Plan forms muestran módulos con nombres (no en blanco)
- [ ] Crear/editar planes funciona
- [ ] Navigation entre páginas funciona
- [ ] Refresh en rutas funciona (gracias a `client/vercel.json`)

### 4. **Configuration Files**
- [ ] `client/vercel.json` existe para SPA routing
- [ ] `railway.json` existe en root para backend
- [ ] `.env` tiene configuraciones correctas para desarrollo

### 5. **Code Quality**
- [ ] No hay errores de TypeScript: `npm run check`
- [ ] No hay imports rotos o dependencias faltantes
- [ ] Console logs de debug removidos (opcional)

---

## 🌐 Production Deployment

### 1. **Git Preparation**
```bash
# Verificar estado limpio
git status

# Commit todos los cambios
git add -A
git commit -m "feat: Description of changes"
git push origin main
```

### 2. **Vercel (Frontend)**
- **Auto-deploy**: Se ejecuta automáticamente con git push
- **Verificar**: Build logs no tienen errores de `drizzle-orm`
- **Variables**: `VITE_API_URL` apunta a Railway

### 3. **Railway (Backend)**  
- **Auto-deploy**: Se ejecuta automáticamente con git push
- **Verificar**: Logs muestran "serving on port 8080"
- **Variables**: `CORS_ORIGIN` incluye dominio de Vercel

### 4. **Post-Deployment Verification**
- [ ] Frontend carga sin errores 404
- [ ] Login funciona
- [ ] API calls funcionan (no hay errores 401)
- [ ] Plan management muestra módulos correctamente
- [ ] Refresh en cualquier ruta funciona

---

## 🐛 Troubleshooting Quick Reference

### Frontend Build Errors
```bash
# Error: drizzle-orm not found
# Verificar: @shared alias en vite.config.ts
"@shared": resolve(__dirname, "src/types")
```

### API Errors en Producción
```bash
# Error: 401 en endpoints específicos
# Verificar: requireBusinessAccount middleware incluye requireAuth

# Error: CORS
# Verificar: CORS_ORIGIN en Railway incluye dominio Vercel
```

### SPA Routing Issues
```bash
# Error: 404 en refresh
# Verificar: client/vercel.json existe con rewrite rules
```

---

## 📋 Workflow Recomendado

1. **Desarrollo Local**
   ```bash
   # Terminal 1: Backend
   npm run server
   
   # Terminal 2: Frontend  
   cd client && npm run dev
   ```

2. **Pre-Deployment Testing**
   ```bash
   # Verificar build
   cd client && npm run build
   
   # Verificar funcionalidad completa
   # - Login, navigation, plan management
   ```

3. **Deploy**
   ```bash
   git add -A
   git commit -m "descriptive message"
   git push origin main
   ```

4. **Post-Deployment Verification**
   - Verificar frontend en Vercel
   - Verificar backend en Railway
   - Probar funcionalidad end-to-end

---

## 🔧 Environment Configuration

### Localhost (.env)
```env
SUPABASE_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
SESSION_SECRET=your-64-char-secret
JWT_SECRET=your-jwt-secret  
SUPER_ADMIN_EMAIL=admin@yourcompany.com
SUPER_ADMIN_PASSWORD=SecurePassword123!
```

### Vercel Environment Variables
```env
VITE_API_URL=https://your-backend.up.railway.app
```

### Railway Environment Variables
```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
SUPABASE_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
SESSION_SECRET=your-64-char-secret
JWT_SECRET=your-jwt-secret
SUPER_ADMIN_EMAIL=admin@yourcompany.com  
SUPER_ADMIN_PASSWORD=SecurePassword123!
CORS_ORIGIN=https://your-frontend.vercel.app
NODE_ENV=production
PORT=8080
```

---

## 🚨 Red Flags - Never Deploy If:

- ❌ Frontend build falla localmente
- ❌ Plan forms muestran módulos en blanco
- ❌ Errores de TypeScript sin resolver
- ❌ `@shared` alias apunta a directorio incorrecto
- ❌ Missing `client/vercel.json` para SPA routing

---

**🎯 Objetivo**: Localhost y producción deben comportarse **idénticamente**.