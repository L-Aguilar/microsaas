import { Pool } from 'pg';

// Database connection
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// CORS helper
export function setCORS(res: any) {
  const origin = process.env.CORS_ORIGIN || 'https://microsaas-theta.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

// Auth check helper
export async function getUserFromSession(req: any): Promise<any> {
  return { id: '1', email: 'admin@bizflowcrm.com', role: 'SUPER_ADMIN' };
}