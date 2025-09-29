import { Pool } from 'pg';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Simple CRM data test - just companies for now
  if (req.query.entity === 'companies') {
    try {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      const companies = await pool.query('SELECT * FROM companies LIMIT 5');
      
      await pool.end();
      return res.status(200).json({
        success: true,
        entity: 'companies',
        data: companies.rows,
        total: companies.rows.length,
        message: 'CRM endpoint working'
      });

    } catch (error) {
      console.error('CRM error:', error);
      return res.status(500).json({ 
        success: false,
        message: 'CRM error',
        error: error.message 
      });
    }
  }

  // If LOGIN query parameters are provided, handle login
  if (req.query.email && req.query.password) {
    const email = req.query.email;
    const password = req.query.password;
    
    try {
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

      // REAL AUTHENTICATION: Validate against actual database passwords
      console.log('Attempting login for:', email);
      console.log('Stored password type:', typeof user.password);
      console.log('Stored password format:', user.password ? 'Present' : 'Missing');
      
      // Check if password is hashed (contains colon indicating salt:hash format)
      const isHashedPassword = user.password && user.password.includes(':');
      
      if (isHashedPassword) {
        // Handle SHA-512 + salt format: salt:hash
        const crypto = await import('crypto');
        const [storedSalt, storedHash] = user.password.split(':');
        
        // Create hash of provided password with stored salt
        const providedHash = crypto.createHmac('sha512', storedSalt)
          .update(password)
          .digest('hex');
        
        if (providedHash === storedHash) {
          await pool.end();
          
          const { password: _, ...userWithoutPassword } = user;
          
          return res.status(200).json({
            user: userWithoutPassword,
            message: 'Login successful - hash verified',
            authMethod: 'database-hash'
          });
        }
      } else {
        // Handle plain text password (if any exist)
        if (user.password === password) {
          await pool.end();
          
          const { password: _, ...userWithoutPassword } = user;
          
          return res.status(200).json({
            user: userWithoutPassword,
            message: 'Login successful - plain text',
            authMethod: 'database-plaintext'
          });
        }
      }

      await pool.end();
      return res.status(401).json({ 
        message: 'Invalid email or password - credentials do not match database',
        authMethod: 'database-validation',
        debug: process.env.NODE_ENV !== 'production' ? { 
          email: email,
          hasStoredPassword: !!user.password,
          isHashed: isHashedPassword,
          passwordLength: user.password ? user.password.length : 0
        } : undefined
      });

    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ 
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Default behavior: database test
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Test connection
    const result = await pool.query('SELECT NOW() as current_time');
    
    // Check users table
    const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
    
    // Check for admin user
    const adminCheck = await pool.query(
      'SELECT email, role FROM users WHERE email = $1',
      [process.env.SUPER_ADMIN_EMAIL || 'admin@bizflowcrm.com']
    );

    await pool.end();

    return res.status(200).json({
      success: true,
      currentTime: result.rows[0].current_time,
      totalUsers: userCount.rows[0].count,
      adminExists: adminCheck.rows.length > 0,
      adminData: adminCheck.rows[0] || null
    });

  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      hasDbUrl: !!process.env.DATABASE_URL
    });
  }
}