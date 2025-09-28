import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pool, setCORS } from './_lib/config';
import bcrypt from 'bcrypt';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCORS(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Check if admin already exists
    const existingAdmin = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [process.env.SUPER_ADMIN_EMAIL]
    );

    if (existingAdmin.rows.length > 0) {
      return res.status(200).json({ message: 'Database already initialized' });
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD || 'default', 10);
    
    const newAdmin = await pool.query(`
      INSERT INTO users (name, email, password, role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id, name, email, role
    `, [
      'Super Admin',
      process.env.SUPER_ADMIN_EMAIL,
      hashedPassword,
      'SUPER_ADMIN'
    ]);

    res.status(201).json({
      message: 'Database initialized successfully',
      admin: newAdmin.rows[0]
    });
  } catch (error) {
    console.error('Init error:', error);
    res.status(500).json({ 
      message: 'Failed to initialize database',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}