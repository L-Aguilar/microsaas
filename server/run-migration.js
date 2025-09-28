import { Pool } from 'pg';
import * as fs from 'fs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  const sql = fs.readFileSync('./server/migrate-remove-contact-fields.sql', 'utf8');
  
  console.log('Running migration to remove contactName field...');
  console.log(sql);
  
  try {
    const result = await pool.query(sql);
    console.log('Migration completed successfully');
    console.log('Result:', result);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration();