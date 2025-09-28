import { Pool } from 'pg';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Test connection
    const result = await pool.query('SELECT NOW() as current_time');
    
    // Check users table
    const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
    
    // Check for admin user
    const adminCheck = await pool.query(
      'SELECT email, role FROM users WHERE email = $1',
      [process.env.SUPER_ADMIN_EMAIL || 'admin@bizflowcrm.com']
    );

    await pool.end();

    return res.status(200).json({
      success: true,
      currentTime: result.rows[0].current_time,
      totalUsers: userCount.rows[0].count,
      adminExists: adminCheck.rows.length > 0,
      adminData: adminCheck.rows[0] || null
    });

  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      hasDbUrl: !!process.env.DATABASE_URL
    });
  }
}