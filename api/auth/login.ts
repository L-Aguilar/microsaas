import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email, password } = req.body || {};

  // Hardcoded auth
  if (email === 'admin@bizflowcrm.com' && password === 'SecureAdmin2024!@#BizFlow') {
    return res.status(200).json({
      user: {
        id: '1',
        name: 'Super Admin',
        email: 'admin@bizflowcrm.com',
        role: 'SUPER_ADMIN'
      },
      message: 'Login successful'
    });
  }

  return res.status(401).json({ message: 'Invalid credentials' });
}