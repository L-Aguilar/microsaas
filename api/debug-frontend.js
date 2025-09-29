import { Pool } from 'pg';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { test } = req.query;

  if (test === 'simple') {
    // Return minimal test data
    return res.status(200).json({
      success: true,
      message: 'Simple endpoint working',
      data: [
        {
          id: '1',
          name: 'Test Company',
          created_at: '2025-09-29T15:00:00.000Z',
          opportunities_count: 0
        }
      ],
      total: 1
    });
  }

  if (test === 'companies') {
    try {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      // Return very simple company data to test format
      const result = await pool.query(`
        SELECT 
          id,
          name,
          email,
          phone,
          website,
          status,
          created_at,
          updated_at
        FROM companies 
        WHERE business_account_id IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 5
      `);
      
      await pool.end();
      
      // Ensure all fields are properly formatted and safe
      const simpleData = result.rows.map(row => ({
        id: String(row.id),
        name: String(row.name || 'Unknown'),
        email: String(row.email || ''),
        phone: String(row.phone || ''),
        website: String(row.website || ''),
        status: String(row.status || 'ACTIVE'),
        created_at: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
        updated_at: row.updated_at ? row.updated_at.toISOString() : new Date().toISOString(),
        opportunities_count: 0
      }));
      
      return res.status(200).json(simpleData);

    } catch (error) {
      console.error('Debug error:', error);
      return res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }

  if (test === 'stats') {
    // Return simple stats without complex queries
    return res.status(200).json({
      stats: {
        total_companies: 14,
        total_opportunities: 2,
        total_revenue: 50000,
        total_users: 6,
        total_activities: 3
      },
      monthly_growth: [
        { month: "2025-08-01T00:00:00.000Z", companies: 1 },
        { month: "2025-09-01T00:00:00.000Z", companies: 13 }
      ],
      opportunity_status: [
        { status: "QUALIFYING", count: 1 },
        { status: "NEW", count: 1 }
      ]
    });
  }

  return res.status(200).json({
    message: 'Debug endpoint',
    availableTests: ['simple', 'companies', 'stats'],
    usage: 'Add ?test=simple or ?test=companies or ?test=stats'
  });
}