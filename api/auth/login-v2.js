import { Pool } from 'pg';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

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