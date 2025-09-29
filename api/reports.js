import { Pool } from 'pg';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Get stats for dashboard
    const [companiesResult, opportunitiesResult, usersResult, activitiesResult] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM companies WHERE business_account_id IS NOT NULL'),
      pool.query('SELECT COUNT(*) as count, SUM(COALESCE(amount, 0)) as total_amount FROM opportunities WHERE business_account_id IS NOT NULL'),
      pool.query('SELECT COUNT(*) as count FROM users'),
      pool.query('SELECT COUNT(*) as count FROM activities WHERE business_account_id IS NOT NULL')
    ]);

    // Get monthly growth data
    const monthlyData = await pool.query(`
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as companies_added
      FROM companies 
      WHERE business_account_id IS NOT NULL 
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month
    `);

    // Get opportunity status breakdown
    const statusBreakdown = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM opportunities
      WHERE business_account_id IS NOT NULL
      GROUP BY status
    `);

    await pool.end();

    return res.status(200).json({
      success: true,
      stats: {
        total_companies: parseInt(companiesResult.rows[0].count),
        total_opportunities: parseInt(opportunitiesResult.rows[0].count),
        total_revenue: parseFloat(opportunitiesResult.rows[0].total_amount || 0),
        total_users: parseInt(usersResult.rows[0].count),
        total_activities: parseInt(activitiesResult.rows[0].count)
      },
      monthly_growth: monthlyData.rows.map(row => ({
        month: row.month,
        companies: parseInt(row.companies_added)
      })),
      opportunity_status: statusBreakdown.rows.map(row => ({
        status: row.status,
        count: parseInt(row.count)
      }))
    });

  } catch (error) {
    console.error('Reports API error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message 
    });
  }
}