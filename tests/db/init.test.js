import { describe, test, expect } from '@jest/globals';
import { initDatabase } from '../../src/db/init.js';

describe('Database Initialization', () => {
  test('should initialize database tables successfully', async () => {
    // This will use the mock database since DATABASE_URL is not set
    await expect(initDatabase()).resolves.not.toThrow();
  });

  test('should handle errors during initialization', async () => {
    // Create a mock pool that throws an error
    const mockPool = {
      query: async () => {
        throw new Error('Database connection failed');
      }
    };

    // Temporarily replace the pool
    const connectionModule = await import('../../src/db/connection.js');
    const originalPool = connectionModule.default;

    try {
      // Replace with error-throwing pool
      Object.assign(connectionModule.default, mockPool);

      // Should throw the error
      await expect(initDatabase()).rejects.toThrow('Database connection failed');
    } finally {
      // Restore original pool
      Object.assign(connectionModule.default, originalPool);
    }
  });
});
