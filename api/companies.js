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
        // Get current user info from query params for authorization
        const { current_user_role, current_business_account_id } = req.query;
        
        let companiesQuery;
        let queryParams = [];
        
        if (current_user_role === 'SUPER_ADMIN') {
          // SUPER_ADMIN can see all companies
          companiesQuery = `
            SELECT c.*, COUNT(o.id) as opportunities_count
            FROM companies c
            LEFT JOIN opportunities o ON c.id = o.company_id
            WHERE c.business_account_id IS NOT NULL
            GROUP BY c.id
            ORDER BY c.created_at DESC
          `;
        } else if (current_business_account_id) {
          // BUSINESS_PLAN and USER can only see companies from their business account
          companiesQuery = `
            SELECT c.*, COUNT(o.id) as opportunities_count
            FROM companies c
            LEFT JOIN opportunities o ON c.id = o.company_id
            WHERE c.business_account_id = $1
            GROUP BY c.id
            ORDER BY c.created_at DESC
          `;
          queryParams = [current_business_account_id];
        } else {
          // No access if no business account
          await pool.end();
          return res.status(403).json({ message: 'Access denied' });
        }
        
        const companies = await pool.query(companiesQuery, queryParams);
        
        await pool.end();
        return res.status(200).json({
          success: true,
          companies: companies.rows,
          total: companies.rows.length
        });

      case 'POST':
        const { name, email, phone, website, industry, status = 'LEAD' } = req.body || {};
        
        if (!name) {
          await pool.end();
          return res.status(400).json({ message: 'Company name is required' });
        }

        // Get a business account ID (using the first one for now)
        const businessAccount = await pool.query('SELECT id FROM business_accounts LIMIT 1');
        if (businessAccount.rows.length === 0) {
          await pool.end();
          return res.status(400).json({ message: 'No business account found' });
        }

        const newCompany = await pool.query(`
          INSERT INTO companies (name, email, phone, website, industry, status, business_account_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `, [name, email, phone, website, industry, status, businessAccount.rows[0].id]);
        
        await pool.end();
        return res.status(201).json({
          success: true,
          company: newCompany.rows[0]
        });

      default:
        await pool.end();
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Companies API error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message 
    });
  }
}