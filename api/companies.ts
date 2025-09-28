import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pool, setCORS, getUserFromSession } from './_lib/config';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCORS(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const user = await getUserFromSession(req);
    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    switch (req.method) {
      case 'GET':
        const companies = await pool.query(`
          SELECT c.*, COUNT(o.id) as opportunities_count
          FROM companies c
          LEFT JOIN opportunities o ON c.id = o.company_id
          WHERE c.deleted_at IS NULL
          GROUP BY c.id
          ORDER BY c.created_at DESC
        `);
        
        res.status(200).json(companies.rows);
        break;

      case 'POST':
        const { name, email, phone, address, website, industry } = req.body;
        
        const newCompany = await pool.query(`
          INSERT INTO companies (name, email, phone, address, website, industry)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `, [name, email, phone, address, website, industry]);
        
        res.status(201).json(newCompany.rows[0]);
        break;

      default:
        res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Companies API error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}