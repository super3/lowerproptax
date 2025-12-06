import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock node-pg-migrate runner
const mockRunner = jest.fn();
jest.unstable_mockModule('node-pg-migrate', () => ({
  runner: mockRunner
}));

describe('Database Initialization', () => {
  const originalEnv = process.env.DATABASE_URL;
  let initDatabase;

  beforeEach(async () => {
    delete process.env.DATABASE_URL;
    jest.clearAllMocks();
    jest.resetModules();
    const module = await import('../../src/db/init.js');
    initDatabase = module.initDatabase;
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
    expect(mockRunner).not.toHaveBeenCalled();
  });

  test('should run migrations successfully when DATABASE_URL is set', async () => {
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
    mockRunner.mockResolvedValueOnce();

    await initDatabase();

    expect(mockRunner).toHaveBeenCalledWith(
      expect.objectContaining({
        databaseUrl: 'postgres://test:test@localhost:5432/test',
        direction: 'up',
        migrationsTable: 'pgmigrations'
      })
    );
  });

  test('should throw error when database connection fails', async () => {
    process.env.DATABASE_URL = 'postgres://fake:fake@localhost:5432/fake';
    mockRunner.mockRejectedValueOnce(new Error('Connection refused'));

    await expect(initDatabase()).rejects.toThrow('Connection refused');
  });
});
