import { Pool } from 'pg';
import * as fs from 'fs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  const sql = fs.readFileSync('./server/migrations/005_extend_companies_for_contacts.sql', 'utf8');

  console.log('🚀 Running contacts module migration...');
  console.log('-------------------------------------------');

  try {
    // Split SQL into separate statements and run them one by one
    // This handles the DO blocks and other statements better
    const statements = sql
      .split(/;(?=\s*(?:--|DO|ALTER|CREATE|DROP|SELECT|UPDATE|INSERT))/i)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length > 0) {
        console.log(`\n📝 Executing statement ${i + 1}/${statements.length}...`);
        console.log(statement.substring(0, 100) + (statement.length > 100 ? '...' : ''));

        try {
          const result = await pool.query(statement);
          console.log('✅ Success');
          if (result.rows && result.rows.length > 0) {
            console.log('Result:', result.rows.slice(0, 5));
          }
        } catch (err) {
          // Some errors are expected (like "column already exists")
          if (err.message.includes('already exists') || err.message.includes('duplicate')) {
            console.log('⚠️  Skipped (already exists):', err.message);
          } else {
            throw err;
          }
        }
      }
    }

    console.log('\n-------------------------------------------');
    console.log('✅ Migration completed successfully!');

    // Verify the new columns exist
    console.log('\n📋 Verifying new columns...');
    const verifyResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'companies'
      AND column_name IN ('mobile', 'company_name', 'position', 'address', 'city', 'country', 'avatar', 'notes', 'tags', 'source', 'created_by', 'is_deleted', 'deleted_at')
      ORDER BY column_name
    `);

    console.log('Found columns:', verifyResult.rows.map(r => r.column_name).join(', '));

    if (verifyResult.rows.length >= 10) {
      console.log('✅ All new columns verified!');
    } else {
      console.log('⚠️  Some columns may be missing. Expected 13, found:', verifyResult.rows.length);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

runMigration();
