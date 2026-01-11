import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config();

async function runPlansDualPricingMigration() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DATABASE_URL
  });

  try {
    await client.connect();
    console.log('🔄 Ejecutando migración para precios duales en planes...');

    // Read and execute the SQL migration
    const migrationSQL = readFileSync(join(__dirname, 'migrate-add-plans-dual-pricing.sql'), 'utf8');
    
    await client.query(migrationSQL);
    
    console.log('✅ Migración de precios duales en planes completada exitosamente!');
    console.log('📊 Se agregaron las columnas monthly_price, annual_price e is_active a la tabla plans');
    
    // Verify the migration
    const result = await client.query(`
      SELECT 
        id, 
        name, 
        price, 
        monthly_price, 
        annual_price, 
        trial_days,
        is_active,
        billing_frequency 
      FROM plans 
      ORDER BY name
    `);
    
    console.log('\\n📋 Planes después de la migración:');
    result.rows.forEach(plan => {
      console.log(`- ${plan.name}: price=${plan.price}, monthly=${plan.monthly_price}, annual=${plan.annual_price}, trial=${plan.trial_days}d, active=${plan.is_active}`);
    });
    
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runPlansDualPricingMigration();