import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config();

async function runDualPricingMigration() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DATABASE_URL
  });

  try {
    await client.connect();
    console.log('🔄 Ejecutando migración para precios duales...');

    // Read and execute the SQL migration
    const migrationSQL = readFileSync(join(__dirname, 'migrate-add-dual-pricing.sql'), 'utf8');
    
    await client.query(migrationSQL);
    
    console.log('✅ Migración de precios duales completada exitosamente!');
    console.log('📊 Se agregaron las columnas monthly_price y annual_price a la tabla products');
    
    // Verify the migration
    const result = await client.query(`
      SELECT 
        id, 
        name, 
        price, 
        monthly_price, 
        annual_price, 
        billing_frequency 
      FROM products 
      LIMIT 5
    `);
    
    console.log('\n📋 Primeros 5 productos después de la migración:');
    result.rows.forEach(product => {
      console.log(`- ${product.name}: ${product.price} -> Monthly: ${product.monthly_price}, Annual: ${product.annual_price}`);
    });
    
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runDualPricingMigration();