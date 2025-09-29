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
    // Return minimal test data WITHOUT DATES
    return res.status(200).json([
      {
        id: '1',
        name: 'Test Company 1',
        email: 'test1@example.com',
        phone: '+1234567890',
        website: 'https://example.com',
        status: 'ACTIVE',
        opportunities_count: 0
      },
      {
        id: '2',
        name: 'Test Company 2',
        email: 'test2@example.com',
        phone: '+1234567891',
        website: 'https://example2.com',
        status: 'LEAD',
        opportunities_count: 1
      }
    ]);
  }

  if (test === 'fake-companies') {
    // Return completely fake data without database
    return res.status(200).json([
      {
        id: 'fake-1',
        name: 'Fake Company Alpha',
        email: 'fake@alpha.com',
        phone: '+1111111111',
        website: 'https://alpha.fake',
        status: 'ACTIVE',
        opportunities_count: 5
      },
      {
        id: 'fake-2',
        name: 'Fake Company Beta',
        email: 'fake@beta.com',
        phone: '+2222222222',
        website: 'https://beta.fake',
        status: 'LEAD',
        opportunities_count: 3
      },
      {
        id: 'fake-3',
        name: 'Fake Company Gamma',
        email: 'fake@gamma.com',
        phone: '+3333333333',
        website: 'https://gamma.fake',
        status: 'INACTIVE',
        opportunities_count: 0
      }
    ]);
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
      
      // ULTRA SAFE - Remove ALL dates to isolate the problem
      const simpleData = result.rows.map(row => ({
        id: String(row.id),
        name: String(row.name || 'Unknown'),
        email: String(row.email || ''),
        phone: String(row.phone || ''),
        website: String(row.website || ''),
        status: String(row.status || 'ACTIVE'),
        // created_at: "2025-09-29T15:00:00.000Z", // Fixed safe date
        // updated_at: "2025-09-29T15:00:00.000Z", // Fixed safe date
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

  if (test === 'fake-login') {
    // Return fake user data without problematic dates
    return res.status(200).json({
      user: {
        id: 'fake-user-123',
        name: 'Fake User',
        email: 'fake@example.com',
        role: 'BUSINESS_PLAN',
        business_account_id: 'fake-account-456',
        phone: '+1234567890'
        // NO created_at, updated_at or any dates!
      },
      message: 'Fake login successful',
      authMethod: 'fake-auth'
    });
  }

  return res.status(200).json({
    message: 'Debug endpoint',
    availableTests: ['simple', 'companies', 'stats', 'fake-companies', 'fake-login'],
    usage: 'Add ?test=simple or ?test=companies or ?test=stats'
  });
}