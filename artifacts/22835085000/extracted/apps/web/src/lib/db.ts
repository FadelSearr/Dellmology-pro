import { Pool } from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  'postgresql://localhost:5433/dellmology';

let pool: Pool;

// Use a global variable in development to prevent connection pool exhaustion during hot-reloads.
// In production, the app is initialized once, so this isn't an issue.
if (process.env.NODE_ENV === 'production') {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.DB_SSL_DISABLE === 'true' ? false : { rejectUnauthorized: false },
  });
} else {
  // Ensure the pool is created only once in development.
  if (!global._pgPool) {
    global._pgPool = new Pool({
      connectionString: DATABASE_URL,
    });
  }
  pool = global._pgPool;
}

export const db = pool;
