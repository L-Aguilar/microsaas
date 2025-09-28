#!/bin/bash

# Script para preparar ShimliAdmin para un nuevo repositorio
# Uso: ./scripts/prepare-new-repo.sh [nuevo-nombre-repo]

set -e

echo "🚀 Preparando ShimliAdmin para nuevo repositorio..."

# Verificar si se proporcionó un nombre de repositorio
if [ -z "$1" ]; then
    echo "❌ Error: Debes proporcionar el nombre del nuevo repositorio"
    echo "Uso: ./scripts/prepare-new-repo.sh [nuevo-nombre-repo]"
    echo "Ejemplo: ./scripts/prepare-new-repo.sh mi-bizflowcrm"
    exit 1
fi

NEW_REPO_NAME=$1
CURRENT_DIR=$(pwd)
PROJECT_NAME=$(basename "$CURRENT_DIR")

echo "📁 Directorio actual: $CURRENT_DIR"
echo "📦 Nombre del proyecto: $PROJECT_NAME"
echo "🆕 Nuevo nombre del repositorio: $NEW_REPO_NAME"

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ] || [ ! -f "vite.config.ts" ]; then
    echo "❌ Error: No se encontró package.json o vite.config.ts"
    echo "Asegúrate de estar en el directorio raíz del proyecto ShimliAdmin"
    exit 1
fi

# Verificar estado de Git
if ! git status --porcelain | grep -q .; then
    echo "✅ No hay cambios pendientes en Git"
else
    echo "⚠️  Hay cambios pendientes en Git. Asegúrate de hacer commit antes de continuar."
    echo "Cambios pendientes:"
    git status --porcelain
    echo ""
    read -p "¿Continuar de todas formas? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Operación cancelada"
        exit 1
    fi
fi

# Actualizar package.json con el nuevo nombre del repositorio
echo "📝 Actualizando package.json..."
sed -i.bak "s/\"name\": \"$PROJECT_NAME\"/\"name\": \"$NEW_REPO_NAME\"/" package.json
sed -i.bak "s/\"url\": \"https:\/\/github.com\/tu-usuario\/shimliadmin.git\"/\"url\": \"https:\/\/github.com\/tu-usuario\/$NEW_REPO_NAME.git\"/" package.json

# Limpiar archivos de backup
rm -f package.json.bak

# Verificar que no hay archivos sensibles
echo "🔒 Verificando archivos sensibles..."
if [ -f ".env" ]; then
    echo "⚠️  ADVERTENCIA: Se encontró archivo .env"
    echo "   Asegúrate de que esté en .gitignore y no contenga información sensible"
fi

if [ -f "supabase-setup.sql" ]; then
    echo "⚠️  ADVERTENCIA: Se encontró supabase-setup.sql"
    echo "   Considera moverlo a scripts/ o documentación/"
fi

# Crear archivo de instrucciones para el nuevo repositorio
echo "📋 Creando instrucciones para el nuevo repositorio..."
cat > NEW_REPO_INSTRUCTIONS.md << EOF
# 🚀 Instrucciones para Nuevo Repositorio: $NEW_REPO_NAME

## Pasos para configurar el nuevo repositorio:

### 1. Crear nuevo repositorio en GitHub
- Ve a https://github.com/new
- Nombre: \`$NEW_REPO_NAME\`
- Descripción: "Sistema de Administración Shimli - CRM moderno y completo"
- Público o Privado según tus preferencias
- NO inicialices con README, .gitignore o licencia

### 2. Actualizar la URL del repositorio en package.json
El archivo ya ha sido actualizado con el placeholder correcto.
Cambia \`tu-usuario\` por tu nombre de usuario real de GitHub.

### 3. Configurar el nuevo remoto
\`\`\`bash
# Remover el remoto actual (si existe)
git remote remove origin

# Agregar el nuevo remoto
git remote add origin https://github.com/tu-usuario/$NEW_REPO_NAME.git

# Verificar el remoto
git remote -v
\`\`\`

### 4. Subir al nuevo repositorio
\`\`\`bash
# Hacer push al nuevo repositorio
git push -u origin main
\`\`\`

### 5. Configurar variables de entorno
\`\`\`bash
# Copiar el archivo de ejemplo
cp env.example .env

# Editar con tus valores reales
nano .env
\`\`\`

### 6. Configurar Supabase
\`\`\`bash
# Ejecutar el script de configuración
npm run setup:supabase
\`\`\`

### 7. Verificar la configuración
\`\`\`bash
# Verificar que todo esté configurado correctamente
npm run verify:supabase
\`\`\`

## 🎉 ¡Listo!
Tu BizFlowCRM está ahora en el nuevo repositorio y listo para usar.

## 📚 Documentación adicional
- [README.md](README.md) - Documentación principal del proyecto
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Guía de despliegue
- [SUPABASE_SETUP_GUIDE.md](SUPABASE_SETUP_GUIDE.md) - Configuración de Supabase
EOF

echo "✅ Proyecto preparado exitosamente!"
echo ""
echo "📋 Próximos pasos:"
echo "1. Crear el nuevo repositorio en GitHub: $NEW_REPO_NAME"
echo "2. Actualizar la URL en package.json con tu usuario real"
echo "3. Ejecutar: git remote add origin https://github.com/tu-usuario/$NEW_REPO_NAME.git"
echo "4. Ejecutar: git push -u origin main"
echo ""
echo "📖 Instrucciones detalladas guardadas en: NEW_REPO_INSTRUCTIONS.md"
echo ""
echo "🔧 Para continuar con la configuración:"
echo "   - Revisa NEW_REPO_INSTRUCTIONS.md"
echo "   - Configura las variables de entorno"
echo "   - Configura Supabase"
echo ""
echo "🎉 ¡ShimliAdmin está listo para el nuevo repositorio!"
