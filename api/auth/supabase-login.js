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

  // Debug: log everything about the request
  console.log('=== REQUEST DEBUG ===');
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body type:', typeof req.body);
  console.log('Body value:', req.body);
  console.log('Body as string:', String(req.body));
  
  // Try different ways to get the body
  let email, password;
  
  // Try direct access
  if (req.body && typeof req.body === 'object') {
    email = req.body.email;
    password = req.body.password;
    console.log('Method 1 - Direct object access:', { email: !!email, password: !!password });
  }
  
  // If that didn't work, try parsing as JSON string
  if (!email || !password) {
    try {
      const parsed = JSON.parse(req.body);
      email = parsed.email;
      password = parsed.password;
      console.log('Method 2 - JSON.parse:', { email: !!email, password: !!password });
    } catch (e) {
      console.log('JSON parse failed:', e.message);
    }
  }
  
  // Last resort: return debug info
  if (!email || !password) {
    return res.status(400).json({ 
      message: 'Email and password are required',
      debug: {
        bodyType: typeof req.body,
        bodyValue: req.body,
        bodyString: String(req.body),
        headers: req.headers
      }
    });
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