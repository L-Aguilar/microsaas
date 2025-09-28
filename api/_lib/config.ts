import 'dotenv/config';
import { Pool } from 'pg';

// Database connection
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// CORS origins
export const corsOrigins = process.env.CORS_ORIGIN?.split(',').map(origin => origin.trim()) || ['http://localhost:5173'];

// Auth check helper
export async function getUserFromSession(req: any): Promise<any> {
  // Simple session check - you'll need to implement proper session handling
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  
  try {
    // For now, just return a mock user - implement proper JWT/session validation
    return { id: '1', email: 'admin@bizflowcrm.com', role: 'SUPER_ADMIN' };
  } catch {
    return null;
  }
}

// CORS helper
export function setCORS(res: any) {
  res.setHeader('Access-Control-Allow-Origin', corsOrigins.join(','));
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}