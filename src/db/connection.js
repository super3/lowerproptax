import pg from 'pg';
import { createMockPool } from '../../tests/utils/mockDatabase.js';
const { Pool } = pg;

let pool;

// Check if DATABASE_URL is available
if (process.env.DATABASE_URL) {
  // Use real PostgreSQL connection
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false
  });

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
    process.exit(-1);
  });

  // Test connection
  pool.on('connect', () => {
    console.log('PostgreSQL client connected');
  });
} else {
  // Use mock pool for testing when DATABASE_URL is not set
  console.log('DATABASE_URL not set - using mock database for testing');
  pool = createMockPool();
}

export default pool;
