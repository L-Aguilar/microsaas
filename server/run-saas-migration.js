import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { pool } from './db.ts';
import fs from 'fs';

async function runSaaSMigration() {
  console.log('🚀 Starting SaaS Plans Migration...');
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrate-add-saas-plans.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Run the migration
    await pool.query(migrationSQL);
    
    console.log('✅ SaaS Plans Migration completed successfully!');
    console.log('📊 Created tables: plans, products, plan_modules, business_account_plans, business_account_products, plan_usage');
    console.log('🎯 Inserted default plan and sample products');
    
    // Verify the migration
    const planCount = await pool.query('SELECT COUNT(*) FROM plans');
    const productCount = await pool.query('SELECT COUNT(*) FROM products');
    
    console.log(`📈 Plans created: ${planCount.rows[0].count}`);
    console.log(`🛍️  Products created: ${productCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSaaSMigration()
    .then(() => {
      console.log('🎉 Migration completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export { runSaaSMigration };