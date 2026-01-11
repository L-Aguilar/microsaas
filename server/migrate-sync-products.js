import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const AVAILABLE_MODULES = {
  USERS: {
    name: 'Usuarios',
    type: 'USERS',
    description: 'Gestión de usuarios y permisos dentro de la organización',
    hasLimits: true,
    defaultLimit: 5
  },
  COMPANIES: {
    name: 'Empresas',
    type: 'COMPANIES',
    description: 'Gestión de empresas y contactos comerciales',
    hasLimits: true,
    defaultLimit: 100
  },
  CRM: {
    name: 'CRM',
    type: 'CRM',
    description: 'Gestión de relaciones con clientes, oportunidades y actividades',
    hasLimits: false,
    defaultLimit: null
  },
  BILLING: {
    name: 'Facturación',
    type: 'BILLING',
    description: 'Sistema de facturación y gestión de pagos',
    hasLimits: false,
    defaultLimit: null
  },
  INVENTORY: {
    name: 'Inventario',
    type: 'INVENTORY',
    description: 'Gestión de inventario y productos',
    hasLimits: true,
    defaultLimit: 1000
  },
  HR: {
    name: 'Recursos Humanos',
    type: 'HR',
    description: 'Gestión de empleados y recursos humanos',
    hasLimits: true,
    defaultLimit: 50
  },
  ANALYTICS: {
    name: 'Analíticas',
    type: 'ANALYTICS',
    description: 'Reportes y analíticas avanzadas',
    hasLimits: false,
    defaultLimit: null
  },
  REPORTS: {
    name: 'Reportes',
    type: 'REPORTS',
    description: 'Generación de reportes personalizados',
    hasLimits: false,
    defaultLimit: null
  },
  AUTOMATION: {
    name: 'Automatización',
    type: 'AUTOMATION',
    description: 'Automatización de procesos y flujos de trabajo',
    hasLimits: true,
    defaultLimit: 10
  }
};

async function syncProducts() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DATABASE_URL
  });

  try {
    await client.connect();
    console.log('🔄 Sincronizando productos con módulos del sistema...');

    // 1. Limpiar productos existentes
    console.log('🗑️  Eliminando productos existentes...');
    await client.query('DELETE FROM products');

    // 2. Crear productos para cada módulo
    console.log('📦 Creando productos para módulos...');
    for (const [key, module] of Object.entries(AVAILABLE_MODULES)) {
      const productData = {
        name: `Módulo ${module.name}`,
        description: module.description,
        type: 'MODULE',
        price: module.hasLimits ? '29.99' : '39.99', // Precio base según si tiene límites
        billingFrequency: 'MONTHLY',
        moduleType: module.type,
        isActive: true,
        metadata: JSON.stringify({
          hasLimits: module.hasLimits,
          defaultLimit: module.defaultLimit,
          features: [
            `Acceso completo a ${module.name}`,
            module.hasLimits ? `Hasta ${module.defaultLimit || 'ilimitado'} elementos` : 'Sin límites',
            'Soporte técnico incluido'
          ]
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

      console.log(`✅ Creado: ${productData.name}`);
    }

    // 3. Crear productos adicionales (no módulos específicos)
    console.log('🔧 Creando productos adicionales...');
    
    const additionalProducts = [
      {
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
          features: ['Acceso completo a todas las funciones', 'Sin restricciones de módulos']
        })
      },
      {
        name: 'Almacenamiento Extra',
        description: 'Espacio de almacenamiento adicional para archivos y datos',
        type: 'STORAGE_ADDON',
        price: '2.99',
        billingFrequency: 'MONTHLY',
        moduleType: null,
        isActive: true,
        metadata: JSON.stringify({
          unit: 'GB',
          increment: 10,
          features: ['10GB de almacenamiento adicional', 'Backup automático', 'Alta disponibilidad']
        })
      },
      {
        name: 'Automatización Avanzada',
        description: 'Funciones adicionales de automatización y workflows',
        type: 'FEATURE_ADDON',
        price: '15.99',
        billingFrequency: 'MONTHLY',
        moduleType: 'AUTOMATION',
        isActive: true,
        metadata: JSON.stringify({
          features: [
            'Workflows complejos ilimitados',
            'Integraciones con APIs externas',
            'Triggers personalizados',
            'Análisis de rendimiento de automatizaciones'
          ]
        })
      },
      {
        name: 'Analíticas Premium',
        description: 'Reportes avanzados y dashboards personalizables',
        type: 'FEATURE_ADDON',
        price: '19.99',
        billingFrequency: 'MONTHLY',
        moduleType: 'ANALYTICS',
        isActive: true,
        metadata: JSON.stringify({
          features: [
            'Dashboards personalizables ilimitados',
            'Exportación a Excel/PDF',
            'Métricas en tiempo real',
            'Alertas inteligentes'
          ]
        })
      }
    ];

    for (const product of additionalProducts) {
      await client.query(`
        INSERT INTO products (name, description, type, price, billing_frequency, module_type, is_active, metadata, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      `, [
        product.name,
        product.description,
        product.type,
        product.price,
        product.billingFrequency,
        product.moduleType,
        product.isActive,
        product.metadata
      ]);

      console.log(`✅ Creado: ${product.name}`);
    }

    console.log('✅ Sincronización de productos completada!');
    console.log(`📊 Total de productos creados: ${Object.keys(AVAILABLE_MODULES).length + additionalProducts.length}`);

  } catch (error) {
    console.error('❌ Error sincronizando productos:', error);
  } finally {
    await client.end();
  }
}

syncProducts();