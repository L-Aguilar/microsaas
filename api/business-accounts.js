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
        const accounts = await pool.query(`
          SELECT ba.*, 
                 COUNT(DISTINCT u.id) as users_count,
                 COUNT(DISTINCT c.id) as companies_count
          FROM business_accounts ba
          LEFT JOIN users u ON ba.id = u.business_account_id
          LEFT JOIN companies c ON ba.id = c.business_account_id
          WHERE ba.status = 'ACTIVE'
          GROUP BY ba.id
          ORDER BY ba.created_at DESC
        `);
        
        await pool.end();
        return res.status(200).json({
          success: true,
          business_accounts: accounts.rows,
          total: accounts.rows.length
        });

      case 'POST':
        const { name, email, status = 'ACTIVE' } = req.body || {};
        
        if (!name) {
          await pool.end();
          return res.status(400).json({ message: 'Business account name is required' });
        }

        const newAccount = await pool.query(`
          INSERT INTO business_accounts (name, email, status)
          VALUES ($1, $2, $3)
          RETURNING *
        `, [name, email, status]);
        
        await pool.end();
        return res.status(201).json({
          success: true,
          business_account: newAccount.rows[0]
        });

      default:
        await pool.end();
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Business Accounts API error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message 
    });
  }
}