import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCORS } from './_lib/config';
import fs from 'fs';
import path from 'path';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCORS(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // If it's an API request that doesn't have a specific function, return 404
  if (req.url?.startsWith('/api/')) {
    return res.status(404).json({ message: 'API endpoint not found' });
  }

  // For all other requests, serve the React app
  try {
    const indexPath = path.join(process.cwd(), 'dist', 'index.html');
    
    if (fs.existsSync(indexPath)) {
      const html = fs.readFileSync(indexPath, 'utf8');
      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(html);
    } else {
      res.status(404).json({ message: 'App not found' });
    }
  } catch (error) {
    console.error('Serve app error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
