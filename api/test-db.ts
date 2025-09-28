import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pool, setCORS } from './_lib/config';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCORS(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Testing database connection...');
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('DATABASE_URL preview:', process.env.DATABASE_URL?.substring(0, 50) + '...');

    // Test basic connection
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('Connection successful, current time:', result.rows[0].current_time);

    // Check if users table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'users'
    `);
    
    console.log('Users table exists:', tableCheck.rows.length > 0);

    // Count users
    const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log('Total users:', userCount.rows[0].count);

    // Check for admin user
    const adminCheck = await pool.query(
      'SELECT email, role FROM users WHERE email = $1',
      [process.env.SUPER_ADMIN_EMAIL]
    );
    
    console.log('Admin user exists:', adminCheck.rows.length > 0);

    res.status(200).json({
      message: 'Database connection test successful',
      connection: 'OK',
      currentTime: result.rows[0].current_time,
      usersTableExists: tableCheck.rows.length > 0,
      totalUsers: userCount.rows[0].count,
      adminExists: adminCheck.rows.length > 0,
      adminEmail: process.env.SUPER_ADMIN_EMAIL,
      adminData: adminCheck.rows[0] || null
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ 
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      hasEnvVar: !!process.env.DATABASE_URL
    });
  }
}