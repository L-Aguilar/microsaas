import { Pool } from 'pg';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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

    // For now, enable all modules for all business accounts
    // This is a simplified implementation since the module system isn't fully implemented
    const modules = [
      { type: 'USERS', isEnabled: true },
      { type: 'COMPANIES', isEnabled: true },
      { type: 'CRM', isEnabled: true }
    ];
    
    await pool.end();
    return res.status(200).json(modules);

  } catch (error) {
    console.error('User Business Account Modules API error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message 
    });
  }
}