import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.SUPABASE_DATABASE_URL) {
  throw new Error(
    "SUPABASE_DATABASE_URL must be set. Get it from your Supabase project settings.",
  );
}

const databaseUrl = process.env.SUPABASE_DATABASE_URL;

// Create connection pool with optimized settings for Supabase
export const pool = new Pool({ 
  connectionString: databaseUrl,
  max: 10, // Reduced from 20 to prevent connection overload
  idleTimeoutMillis: 60000, // Increased to 60 seconds
  connectionTimeoutMillis: 10000, // Increased to 10 seconds
  statement_timeout: 60000, // 60 second query timeout
  ssl: {
    rejectUnauthorized: false // Required for Supabase pooler connections
  }
});

export const db = drizzle(pool, { schema });
