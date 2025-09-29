import { Pool } from 'pg';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // CRM DATA ENDPOINTS
  const { entity } = req.query;
  
  if (entity === 'companies' || entity === 'opportunities' || entity === 'users' || entity === 'activities') {
    try {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      // COMPANIES
      if (entity === 'companies') {
        const companies = await pool.query(`
          SELECT c.*, COUNT(o.id) as opportunities_count
          FROM companies c
          LEFT JOIN opportunities o ON c.id = o.company_id
          WHERE c.business_account_id IS NOT NULL
          GROUP BY c.id
          ORDER BY c.created_at DESC
        `);
        
        await pool.end();
        return res.status(200).json({
          success: true,
          entity: 'companies',
          data: companies.rows,
          total: companies.rows.length
        });
      }

      // OPPORTUNITIES
      if (entity === 'opportunities') {
        const opportunities = await pool.query(`
          SELECT o.*, c.name as company_name, u.name as seller_name
          FROM opportunities o
          LEFT JOIN companies c ON o.company_id = c.id
          LEFT JOIN users u ON o.seller_id = u.id
          WHERE o.business_account_id IS NOT NULL
          ORDER BY o.created_at DESC
        `);
        
        await pool.end();
        return res.status(200).json({
          success: true,
          entity: 'opportunities',
          data: opportunities.rows,
          total: opportunities.rows.length
        });
      }

      // USERS
      if (entity === 'users') {
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
          entity: 'users',
          data: users.rows,
          total: users.rows.length
        });
      }

      // ACTIVITIES
      if (entity === 'activities') {
        const { opportunity_id } = req.query;
        
        let query = `
          SELECT a.*, u.name as author_name, o.title as opportunity_title
          FROM activities a
          LEFT JOIN users u ON a.author_id = u.id
          LEFT JOIN opportunities o ON a.opportunity_id = o.id
          WHERE a.business_account_id IS NOT NULL
        `;
        let params = [];

        if (opportunity_id) {
          query += ' AND a.opportunity_id = $1';
          params.push(opportunity_id);
        }

        query += ' ORDER BY a.activity_date DESC';

        const activities = await pool.query(query, params);
        
        await pool.end();
        return res.status(200).json({
          success: true,
          entity: 'activities',
          data: activities.rows,
          total: activities.rows.length
        });
      }

      await pool.end();
    } catch (error) {
      console.error('CRM Data error:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Internal server error',
        error: error.message 
      });
    }
  }

  // If LOGIN query parameters are provided, handle login
  if (req.query.email && req.query.password) {
    const email = req.query.email;
    const password = req.query.password;
    
    try {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      // Query user from Supabase
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        await pool.end();
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const user = result.rows[0];

      // Check if it's the admin with the expected password
      if (email === 'admin@bizflowcrm.com' && password === 'SecureAdmin2024!@#BizFlow') {
        await pool.end();
        
        // Return user data (without password)
        const { password: _, ...userWithoutPassword } = user;
        
        return res.status(200).json({
          user: userWithoutPassword,
          message: 'Login successful'
        });
      }

      await pool.end();
      return res.status(401).json({ message: 'Invalid email or password' });

    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ 
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Default behavior: database test
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