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

    switch (req.method) {
      case 'GET':
        const users = await pool.query(`
          SELECT u.id, u.name, u.email, u.role, u.created_at, u.updated_at,
                 ba.name as business_account_name
          FROM users u
          LEFT JOIN business_accounts ba ON u.business_account_id = ba.id
          ORDER BY u.created_at DESC
        `);
        
        await pool.end();
        return res.status(200).json({
          success: true,
          users: users.rows,
          total: users.rows.length
        });

      case 'POST':
        const { name, email, password, role = 'USER', business_account_id } = req.body || {};
        
        if (!name || !email || !password) {
          await pool.end();
          return res.status(400).json({ message: 'Name, email and password are required' });
        }

        // Check if email already exists
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
          await pool.end();
          return res.status(400).json({ message: 'Email already exists' });
        }

        const newUser = await pool.query(`
          INSERT INTO users (name, email, password, role, business_account_id)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, name, email, role, created_at, updated_at
        `, [name, email, password, role, business_account_id]);
        
        await pool.end();
        return res.status(201).json({
          success: true,
          user: newUser.rows[0]
        });

      default:
        await pool.end();
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Users API error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message 
    });
  }
}