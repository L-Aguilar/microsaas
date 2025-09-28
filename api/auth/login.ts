import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCORS } from '../_lib/config';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    setCORS(res);
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method not allowed' });
    }

    const { email, password } = req.body || {};

    // Temporary hardcoded auth for testing
    if (email === 'admin@bizflowcrm.com' && password === 'SecureAdmin2024!@#BizFlow') {
      const user = {
        id: '1',
        name: 'Super Admin',
        email: 'admin@bizflowcrm.com',
        role: 'SUPER_ADMIN',
        created_at: new Date().toISOString()
      };
      
      return res.status(200).json({
        user,
        message: 'Login successful'
      });
    }

    return res.status(401).json({ message: 'Invalid credentials' });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      message: 'Internal server error',
      error: String(error)
    });
  }
}