import { Pool } from 'pg';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { entity } = req.query; // companies, opportunities, users, activities, business-accounts

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // COMPANIES
    if (entity === 'companies') {
      if (req.method === 'GET') {
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
          companies: companies.rows,
          total: companies.rows.length
        });
      }

      if (req.method === 'POST') {
        const { name, email, phone, website, industry, status = 'LEAD' } = req.body || {};
        
        if (!name) {
          await pool.end();
          return res.status(400).json({ message: 'Company name is required' });
        }

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
      }
    }

    // OPPORTUNITIES  
    if (entity === 'opportunities') {
      if (req.method === 'GET') {
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
          opportunities: opportunities.rows,
          total: opportunities.rows.length
        });
      }

      if (req.method === 'POST') {
        const { title, type = 'NEW_CLIENT', status = 'NEW', amount, probability = 0, estimated_close_date, company_id } = req.body || {};
        
        if (!title || !company_id) {
          await pool.end();
          return res.status(400).json({ message: 'Title and company_id are required' });
        }

        const company = await pool.query('SELECT business_account_id FROM companies WHERE id = $1', [company_id]);
        if (company.rows.length === 0) {
          await pool.end();
          return res.status(400).json({ message: 'Company not found' });
        }

        const newOpportunity = await pool.query(`
          INSERT INTO opportunities (title, type, status, amount, probability, estimated_close_date, company_id, business_account_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `, [title, type, status, amount, probability, estimated_close_date, company_id, company.rows[0].business_account_id]);
        
        await pool.end();
        return res.status(201).json({
          success: true,
          opportunity: newOpportunity.rows[0]
        });
      }
    }

    // USERS
    if (entity === 'users') {
      if (req.method === 'GET') {
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
      }
    }

    // ACTIVITIES
    if (entity === 'activities') {
      if (req.method === 'GET') {
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
          activities: activities.rows,
          total: activities.rows.length
        });
      }
    }

    await pool.end();
    return res.status(400).json({ 
      message: 'Invalid entity or method',
      usage: 'Use ?entity=companies|opportunities|users|activities'
    });

  } catch (error) {
    console.error('CRM Data API error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message 
    });
  }
}