import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCORS, getUserFromSession } from '../_lib/config';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCORS(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const user = await getUserFromSession(req);
    
    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}