import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// SOLO los módulos que realmente existen en el sistema
const REAL_MODULES = {
  USERS: {
    name: 'Usuarios',
    type: 'USERS',
    description: 'Gestión de usuarios y permisos dentro de la organización',
    hasLimits: true,
    defaultLimit: 5,
    price: '29.99',
    features: [
      'Gestión completa de usuarios',
      'Control de roles y permisos',
      'Perfiles de usuario con avatar',
      'Hasta 5 usuarios incluidos'
    ]
  },
  COMPANIES: {
    name: 'Empresas',
    type: 'COMPANIES',
    description: 'Gestión de empresas y contactos comerciales',
    hasLimits: true,
    defaultLimit: 100,
    price: '39.99',
    features: [
      'Base de datos de empresas',
      'Información de contacto completa',
      'Estados de empresa (Lead, Activa, etc.)',
      'Hasta 100 empresas incluidas'
    ]
  },
  CRM: {
    name: 'CRM',
    type: 'CRM',
    description: 'Gestión de relaciones con clientes, oportunidades y actividades',
    hasLimits: false,
    defaultLimit: null,
    price: '49.99',
    features: [
      'Gestión de oportunidades de venta',
      'Seguimiento de actividades',
      'Pipeline de ventas completo',
      'Oportunidades y actividades ilimitadas'
    ]
  },
  REPORTS: {
    name: 'Reportes',
    type: 'REPORTS',
    description: 'Generación de reportes y análisis del negocio',
    hasLimits: false,
    defaultLimit: null,
    price: '29.99',
    features: [
      'Dashboard ejecutivo',
      'Reportes de ventas',
      'Métricas de rendimiento',
      'Análisis de oportunidades'
    ]
  }
};

async function createRealProducts() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DATABASE_URL
  });

  try {
    await client.connect();
    console.log('🔄 Creando SOLO productos reales del sistema...');

    // 1. Limpiar TODOS los productos existentes
    console.log('🗑️  Eliminando todos los productos falsos...');
    await client.query('DELETE FROM products');

    // 2. Crear productos SOLO para módulos que existen
    console.log('📦 Creando productos para módulos reales...');
    
    for (const [key, module] of Object.entries(REAL_MODULES)) {
      const productData = {
        name: `Módulo ${module.name}`,
        description: module.description,
        type: 'MODULE',
        price: module.price,
        billingFrequency: 'MONTHLY',
        moduleType: module.type,
        isActive: true,
        metadata: JSON.stringify({
          hasLimits: module.hasLimits,
          defaultLimit: module.defaultLimit,
          features: module.features
        })
      };

      await client.query(`
        INSERT INTO products (name, description, type, price, billing_frequency, module_type, is_active, metadata, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      `, [
        productData.name,
        productData.description,
        productData.type,
        productData.price,
        productData.billingFrequency,
        productData.moduleType,
        productData.isActive,
        productData.metadata
      ]);

      console.log(`✅ Creado: ${productData.name} - $${productData.price}/mes`);
    }

    // 3. Crear SOLO UN producto adicional real: Usuario Adicional
    console.log('👤 Creando producto de Usuario Adicional...');
    
    const userAddonData = {
      name: 'Usuario Adicional',
      description: 'Agregar usuarios extra más allá del límite del plan',
      type: 'USER_ADDON',
      price: '5.99',
      billingFrequency: 'MONTHLY',
      moduleType: null,
      isActive: true,
      metadata: JSON.stringify({
        unit: 'usuario',
        increment: 1,
        features: [
          'Acceso completo al sistema',
          'Mismo nivel de permisos',
          'Sin restricciones de funcionalidad'
        ]
      })
    };

    await client.query(`
      INSERT INTO products (name, description, type, price, billing_frequency, module_type, is_active, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
    `, [
      userAddonData.name,
      userAddonData.description,
      userAddonData.type,
      userAddonData.price,
      userAddonData.billingFrequency,
      userAddonData.moduleType,
      userAddonData.isActive,
      userAddonData.metadata
    ]);

    console.log(`✅ Creado: ${userAddonData.name} - $${userAddonData.price}/mes`);

    console.log('\n✅ Migración completada!');
    console.log(`📊 Total de productos reales creados: ${Object.keys(REAL_MODULES).length + 1}`);
    console.log('\n📋 RESUMEN:');
    console.log('- 4 módulos reales del sistema');
    console.log('- 1 producto adicional (Usuario Extra)');
    console.log('- 0 productos falsos o inexistentes');

  } catch (error) {
    console.error('❌ Error creando productos reales:', error);
  } finally {
    await client.end();
  }
}

createRealProducts();