import pg from 'pg';
import { createMockPool } from '../../tests/utils/mockDatabase.js';
import type { Pool } from '../types/index.js';

const { Pool: PgPool } = pg;

let pool: Pool;

// Check if DATABASE_URL is available
/* istanbul ignore next */
if (process.env.DATABASE_URL) {
  // Use real PostgreSQL connection
  pool = new PgPool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false
  }) as unknown as Pool;

  // Handle pool errors
  (pool as unknown as pg.Pool).on('error', (err: Error) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
    process.exit(-1);
  });

  // Test connection
  (pool as unknown as pg.Pool).on('connect', () => {
    console.log('PostgreSQL client connected');
  });
} else {
  // Use mock pool for testing when DATABASE_URL is not set
  console.log('DATABASE_URL not set - using mock database for testing');
  pool = createMockPool();
}

export default pool;
