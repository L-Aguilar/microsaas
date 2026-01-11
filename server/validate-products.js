import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const AVAILABLE_MODULES = {
  USERS: { name: 'Usuarios', type: 'USERS' },
  COMPANIES: { name: 'Empresas', type: 'COMPANIES' },
  CRM: { name: 'CRM', type: 'CRM' },
  BILLING: { name: 'Facturación', type: 'BILLING' },
  INVENTORY: { name: 'Inventario', type: 'INVENTORY' },
  HR: { name: 'Recursos Humanos', type: 'HR' },
  ANALYTICS: { name: 'Analíticas', type: 'ANALYTICS' },
  REPORTS: { name: 'Reportes', type: 'REPORTS' },
  AUTOMATION: { name: 'Automatización', type: 'AUTOMATION' }
};

async function validateProducts() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DATABASE_URL
  });

  try {
    await client.connect();
    console.log('🔍 Validando productos del sistema...\n');

    // 1. Obtener todos los productos
    const result = await client.query('SELECT * FROM products ORDER BY type, name');
    const products = result.rows;

    console.log(`📦 Total de productos en base de datos: ${products.length}\n`);

    // 2. Agrupar productos por tipo
    const productsByType = {
      MODULE: [],
      USER_ADDON: [],
      FEATURE_ADDON: [],
      STORAGE_ADDON: []
    };

    products.forEach(product => {
      if (productsByType[product.type]) {
        productsByType[product.type].push(product);
      }
    });

    // 3. Validar productos de módulos
    console.log('🏗️  PRODUCTOS DE MÓDULOS:');
    console.log('='.repeat(50));
    productsByType.MODULE.forEach(product => {
      const isValidModule = Object.values(AVAILABLE_MODULES).some(module => module.type === product.module_type);
      const status = isValidModule ? '✅' : '❌';
      const moduleName = isValidModule ? AVAILABLE_MODULES[product.module_type]?.name : 'MÓDULO NO VÁLIDO';
      
      console.log(`${status} ${product.name} (${product.module_type}) - ${moduleName}`);
      console.log(`   💰 Precio: $${product.price}/${product.billing_frequency.toLowerCase()}`);
      console.log(`   📝 ${product.description}`);
      console.log(`   🟢 Activo: ${product.is_active ? 'Sí' : 'No'}\n`);
    });

    // 4. Validar productos adicionales
    console.log('🔧 PRODUCTOS ADICIONALES:');
    console.log('='.repeat(50));
    
    ['USER_ADDON', 'FEATURE_ADDON', 'STORAGE_ADDON'].forEach(type => {
      const typeNames = {
        USER_ADDON: 'Usuarios Adicionales',
        FEATURE_ADDON: 'Funciones Adicionales', 
        STORAGE_ADDON: 'Almacenamiento'
      };

      console.log(`\n📂 ${typeNames[type]}:`);
      productsByType[type].forEach(product => {
        let validation = '✅';
        let notes = '';
        
        if (type === 'FEATURE_ADDON' && product.module_type) {
          const isValidModule = Object.values(AVAILABLE_MODULES).some(module => module.type === product.module_type);
          if (!isValidModule) {
            validation = '❌';
            notes = ' (módulo no válido)';
          }
        }
        
        console.log(`${validation} ${product.name}${notes}`);
        console.log(`   💰 Precio: $${product.price}/${product.billing_frequency.toLowerCase()}`);
        console.log(`   📝 ${product.description}`);
        if (product.module_type) {
          console.log(`   🔗 Relacionado con: ${AVAILABLE_MODULES[product.module_type]?.name || 'Módulo desconocido'}`);
        }
        console.log(`   🟢 Activo: ${product.is_active ? 'Sí' : 'No'}\n`);
      });
    });

    // 5. Resumen de validación
    console.log('📊 RESUMEN DE VALIDACIÓN:');
    console.log('='.repeat(50));
    console.log(`✅ Módulos disponibles en sistema: ${Object.keys(AVAILABLE_MODULES).length}`);
    console.log(`📦 Productos de módulos creados: ${productsByType.MODULE.length}`);
    console.log(`🔧 Productos adicionales: ${productsByType.USER_ADDON.length + productsByType.FEATURE_ADDON.length + productsByType.STORAGE_ADDON.length}`);
    
    const invalidProducts = products.filter(product => {
      if (product.type === 'MODULE') {
        return !Object.values(AVAILABLE_MODULES).some(module => module.type === product.module_type);
      }
      if (product.type === 'FEATURE_ADDON' && product.module_type) {
        return !Object.values(AVAILABLE_MODULES).some(module => module.type === product.module_type);
      }
      return false;
    });

    if (invalidProducts.length === 0) {
      console.log('🎉 ¡Todos los productos están correctamente alineados con el sistema!');
    } else {
      console.log(`⚠️  ${invalidProducts.length} producto(s) tienen problemas de alineación`);
    }

  } catch (error) {
    console.error('❌ Error validando productos:', error);
  } finally {
    await client.end();
  }
}

validateProducts();