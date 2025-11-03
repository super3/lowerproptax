import { initDatabase } from '../src/db/init.js';

// Initialize the database before all tests
export default async function globalSetup() {
  // Skip database setup if DATABASE_URL is not available (local testing without PostgreSQL)
  if (!process.env.DATABASE_URL) {
    console.log('Skipping database setup - DATABASE_URL not set (tests will use mocked database)');
    return;
  }

  try {
    console.log('Setting up test database...');
    await initDatabase();
    console.log('Test database ready');
  } catch (error) {
    console.error('Failed to setup test database:', error);
    throw error;
  }
}
