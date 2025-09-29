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

      case 'POST':
        const { 
          title, 
          type = 'NEW_CLIENT', 
          status = 'NEW', 
          amount, 
          probability = 0,
          estimated_close_date,
          company_id 
        } = req.body || {};
        
        if (!title || !company_id) {
          await pool.end();
          return res.status(400).json({ message: 'Title and company_id are required' });
        }

        // Get business account ID from company
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

      default:
        await pool.end();
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Opportunities API error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message 
    });
  }
}