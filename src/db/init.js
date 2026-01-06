import { runner } from 'node-pg-migrate';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/* istanbul ignore next */
const noop = () => {};

// Initialize database by running migrations
export async function initDatabase() {
  // Skip migrations if DATABASE_URL is not set (test environment)
  if (!process.env.DATABASE_URL) {
    console.log('Skipping database setup - DATABASE_URL not set (tests will use mocked database)');
    return;
  }

  try {
    console.log('Running database migrations...');

    await runner({
      databaseUrl: process.env.DATABASE_URL,
      dir: join(__dirname, 'migrations'),
      direction: 'up',
      migrationsTable: 'pgmigrations',
      log: noop // Suppress verbose logging
    });

    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Error running database migrations:', error);
    throw error;
  }
}
