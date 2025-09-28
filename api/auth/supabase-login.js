import { Pool } from 'pg';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  let body;
  try {
    // Parse body if it's a string
    if (typeof req.body === 'string') {
      body = JSON.parse(req.body);
    } else {
      body = req.body || {};
    }
  } catch (e) {
    return res.status(400).json({ message: 'Invalid JSON in request body' });
  }

  const { email, password } = body;

  console.log('Request body:', { email: email ? '[PROVIDED]' : '[MISSING]', password: password ? '[PROVIDED]' : '[MISSING]' });

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    console.log('Attempting login for:', email);

    // Query user from Supabase
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    console.log('User found:', result.rows.length > 0);

    if (result.rows.length === 0) {
      await pool.end();
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = result.rows[0];
    console.log('User role:', user.role);

    // For now, we'll compare passwords directly (should use bcrypt in production)
    // Check if it's the admin with the expected password
    if (email === 'admin@bizflowcrm.com' && password === 'SecureAdmin2024!@#BizFlow') {
      await pool.end();
      
      // Return user data (without password)
      const { password: _, ...userWithoutPassword } = user;
      
      console.log('Login successful for:', email);
      
      return res.status(200).json({
        user: userWithoutPassword,
        message: 'Login successful'
      });
    }

    // If we have bcrypt, we can use this:
    // const bcrypt = await import('bcrypt');
    // const isValidPassword = await bcrypt.compare(password, user.password);
    
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