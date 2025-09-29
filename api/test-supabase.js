import { Pool } from 'pg';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // CRM data endpoints
  const { entity } = req.query;
  
  if (entity && ['companies', 'opportunities', 'users', 'activities'].includes(entity)) {
    try {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      let query, result;
      
      switch (entity) {
        case 'companies':
          query = `
            SELECT c.*, COUNT(o.id) as opportunities_count
            FROM companies c
            LEFT JOIN opportunities o ON c.id = o.company_id
            WHERE c.business_account_id IS NOT NULL
            GROUP BY c.id
            ORDER BY c.created_at DESC
            LIMIT 20
          `;
          result = await pool.query(query);
          break;
          
        case 'opportunities':
          query = `
            SELECT o.*, c.name as company_name, u.name as seller_name
            FROM opportunities o
            LEFT JOIN companies c ON o.company_id = c.id
            LEFT JOIN users u ON o.seller_id = u.id
            WHERE o.business_account_id IS NOT NULL
            ORDER BY o.created_at DESC
            LIMIT 20
          `;
          result = await pool.query(query);
          break;
          
        case 'users':
          query = `
            SELECT u.id, u.name, u.email, u.role, u.created_at, u.updated_at,
                   ba.name as business_account_name
            FROM users u
            LEFT JOIN business_accounts ba ON u.business_account_id = ba.id
            ORDER BY u.created_at DESC
          `;
          result = await pool.query(query);
          break;
          
        case 'activities':
          query = `
            SELECT 
              a.*,
              u.name as author_name, 
              o.title as opportunity_title, 
              c.name as company_name,
              COALESCE(a.activity_date, a.created_at) as activity_date,
              CASE 
                WHEN a.reminder_date IS NULL THEN NULL
                ELSE a.reminder_date
              END as reminder_date
            FROM activities a
            LEFT JOIN users u ON a.author_id = u.id
            LEFT JOIN opportunities o ON a.opportunity_id = o.id
            LEFT JOIN companies c ON o.company_id = c.id
            WHERE a.business_account_id IS NOT NULL
            ORDER BY a.activity_date DESC
            LIMIT 20
          `;
          result = await pool.query(query);
          break;
          
        default:
          await pool.end();
          return res.status(400).json({ message: 'Invalid entity' });
      }
      
      await pool.end();
      
      // Clean up any invalid dates in the response
      const cleanedData = result.rows.map(row => {
        const cleaned = { ...row };
        
        // Check all properties for date fields and clean them
        Object.keys(cleaned).forEach(key => {
          if (key.includes('date') || key.includes('_at')) {
            if (cleaned[key] === null || cleaned[key] === undefined || cleaned[key] === '') {
              // Keep as null for explicit null dates
              cleaned[key] = null;
            } else if (typeof cleaned[key] === 'string') {
              // Validate if it's a valid date string
              const date = new Date(cleaned[key]);
              if (isNaN(date.getTime())) {
                // Invalid date, set to null
                console.warn(`Invalid date found in ${entity}.${key}:`, cleaned[key]);
                cleaned[key] = null;
              }
            }
          }
        });
        
        return cleaned;
      });
      
      return res.status(200).json({
        success: true,
        entity: entity,
        data: cleanedData,
        total: cleanedData.length
      });

    } catch (error) {
      console.error(`${entity} CRM error:`, error);
      return res.status(500).json({ 
        success: false,
        message: `${entity} CRM error`,
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