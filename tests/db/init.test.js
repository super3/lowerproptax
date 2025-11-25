import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { initDatabase } from '../../src/db/init.js';

describe('Database Initialization', () => {
  const originalEnv = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.DATABASE_URL = originalEnv;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  test('should skip migrations when DATABASE_URL is not set', async () => {
    // Should return without throwing when DATABASE_URL is not set
    await expect(initDatabase()).resolves.not.toThrow();
  });

  test('should throw error when database connection fails', async () => {
    // Set a fake DATABASE_URL to trigger migration attempt
    process.env.DATABASE_URL = 'postgres://fake:fake@localhost:5432/fake';

    // Should throw an error when trying to connect to non-existent database
    await expect(initDatabase()).rejects.toThrow();
  });
});
