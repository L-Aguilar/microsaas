# Guía de Solución de Problemas - ShimliAdmin

## Problemas Comunes y Soluciones

### 1. Error: "Failed to resolve import @/components/ui/*"
**Síntomas:**
- Errores de importación en Vite
- Componentes no encontrados
- Errores de alias de importación

**Solución:**
```bash
# Verificar que existe client/vite.config.ts
ls -la client/vite.config.ts

# Si no existe, crear el archivo con la configuración correcta
# (Ver archivo client/vite.config.ts actual)
```

### 2. Error: "The border-border class does not exist"
**Síntomas:**
- Errores de Tailwind CSS
- Clases CSS no encontradas
- Diseño roto

**Solución:**
```bash
# Verificar que existe client/tailwind.config.js
ls -la client/tailwind.config.js

# Si no existe o está mal configurado, restaurar la configuración
# (Ver archivo client/tailwind.config.js actual)
```

### 3. Error: "ReferenceError: __dirname is not defined"
**Síntomas:**
- Error al iniciar el servidor
- Problemas con ES modules

**Solución:**
```bash
# Verificar que vite.config.ts tiene la configuración correcta para ES modules
# Debe incluir:
# import { fileURLToPath } from "url";
# const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

### 4. Error: "require is not defined in ES module scope"
**Síntomas:**
- Errores de PostCSS
- Problemas con plugins de Tailwind

**Solución:**
```bash
# Cambiar require() por import en vite.config.ts
# Ejemplo:
# import tailwindcss from "tailwindcss";
# import autoprefixer from "autoprefixer";
```

## Script de Inicio Automático

### Uso del script start-dev.sh:
```bash
# Dar permisos de ejecución
chmod +x start-dev.sh

# Ejecutar
./start-dev.sh
```

### Qué hace el script:
1. Detiene procesos existentes
2. Limpia caché de Vite
3. Verifica archivos de configuración
4. Inicia backend
5. Verifica que backend funcione
6. Inicia frontend
7. Verifica que frontend funcione
8. Maneja Ctrl+C para limpieza

## Archivos Críticos

### client/vite.config.ts
- Configuración de Vite para el frontend
- Alias de importación (@/, @shared, @assets)
- Configuración de PostCSS

### client/tailwind.config.js
- Configuración de Tailwind CSS
- Colores personalizados (brand, sidebar, chart)
- Fuentes y animaciones

### vite.config.ts (raíz)
- Configuración de Vite para el backend
- Configuración de build

## Comandos de Emergencia

### Limpiar todo y reiniciar:
```bash
# Detener todos los procesos
pkill -f "vite"
pkill -f "tsx server/index.ts"

# Limpiar caché
cd client && rm -rf node_modules/.vite && cd ..

# Reiniciar
./start-dev.sh
```

### Verificar puertos:
```bash
# Verificar puerto 8080 (backend)
curl -s http://localhost:8080/api/auth/user

# Verificar puerto 5173 (frontend)
curl -s http://localhost:5173
```

## Notas Importantes

1. **Siempre usar el script start-dev.sh** para iniciar el proyecto
2. **No ejecutar Vite directamente** desde el directorio client sin la configuración correcta
3. **Verificar archivos de configuración** antes de iniciar
4. **Limpiar caché** si hay problemas de importación
5. **Usar Ctrl+C** para detener los servidores correctamente

## Última Actualización
- Fecha: $(date)
- Versión: ShimliAdmin 1.0.0
- Estado: Funcionando correctamente

