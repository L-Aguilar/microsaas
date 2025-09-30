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
        const { opportunity_id, current_user_role, current_business_account_id } = req.query;
        
        let query;
        let params = [];
        
        if (current_user_role === 'SUPER_ADMIN') {
          // SUPER_ADMIN can see all activities
          query = `
            SELECT a.*, u.name as author_name, o.title as opportunity_title
            FROM activities a
            LEFT JOIN users u ON a.author_id = u.id
            LEFT JOIN opportunities o ON a.opportunity_id = o.id
            WHERE a.business_account_id IS NOT NULL
          `;
        } else if (current_business_account_id) {
          // BUSINESS_PLAN and USER can only see activities from their business account
          query = `
            SELECT a.*, u.name as author_name, o.title as opportunity_title
            FROM activities a
            LEFT JOIN users u ON a.author_id = u.id
            LEFT JOIN opportunities o ON a.opportunity_id = o.id
            WHERE a.business_account_id = $1
          `;
          params.push(current_business_account_id);
        } else {
          // No access if no business account
          await pool.end();
          return res.status(403).json({ message: 'Access denied' });
        }

        if (opportunity_id) {
          const paramIndex = params.length + 1;
          query += ` AND a.opportunity_id = $${paramIndex}`;
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

      case 'POST':
        const { 
          opportunity_id, 
          author_id, 
          type = 'NOTE', 
          summary, 
          details,
          activity_date = new Date().toISOString()
        } = req.body || {};
        
        if (!opportunity_id || !author_id || !summary) {
          await pool.end();
          return res.status(400).json({ message: 'opportunity_id, author_id and summary are required' });
        }

        // Get business account ID from opportunity
        const opportunity = await pool.query('SELECT business_account_id FROM opportunities WHERE id = $1', [opportunity_id]);
        if (opportunity.rows.length === 0) {
          await pool.end();
          return res.status(400).json({ message: 'Opportunity not found' });
        }

        const newActivity = await pool.query(`
          INSERT INTO activities (opportunity_id, author_id, type, summary, details, activity_date, business_account_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `, [opportunity_id, author_id, type, summary, details, activity_date, opportunity.rows[0].business_account_id]);
        
        await pool.end();
        return res.status(201).json({
          success: true,
          activity: newActivity.rows[0]
        });

      default:
        await pool.end();
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Activities API error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message 
    });
  }
}