import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

describe('Database Connection', () => {
  let originalEnv;

  beforeAll(() => {
    originalEnv = process.env.DATABASE_URL;
  });

  afterAll(() => {
    process.env.DATABASE_URL = originalEnv;
  });

  test('should create connection pool when DATABASE_URL is not set', async () => {
    // DATABASE_URL is not set in test environment
    expect(process.env.DATABASE_URL).toBeUndefined();

    // Import the connection module
    const { default: pool } = await import('../../src/db/connection.js');

    // Should have query method (mock pool)
    expect(pool.query).toBeDefined();
    expect(typeof pool.query).toBe('function');
  });

  test('should handle mock database queries', async () => {
    const { default: pool } = await import('../../src/db/connection.js');

    // Test DELETE all
    const deleteResult = await pool.query('DELETE FROM properties');
    expect(deleteResult.rows).toEqual([]);

    // Test INSERT
    const insertResult = await pool.query(
      'INSERT INTO properties (id, user_id, address, city, state, zip_code, country, lat, lng, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING *',
      ['test_id', 'user_123', '123 Test St', 'Atlanta', 'GA', '30301', 'USA', 33.7490, -84.3880]
    );
    expect(insertResult.rows[0].id).toBe('test_id');
    expect(insertResult.rows[0].address).toBe('123 Test St');
  });
});
