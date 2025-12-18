import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { validateEnv } from '../../src/config/env.js';

describe('Environment Validation', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('validateEnv', () => {
    test('should pass validation with all required variables', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';
      delete process.env.NODE_ENV;

      const config = validateEnv();

      expect(config.DATABASE_URL).toBe('postgresql://localhost:5432/test');
      expect(config.CLERK_SECRET_KEY).toBe('sk_test_123');
      expect(config.PORT).toBe(3001);
      expect(config.NODE_ENV).toBe('development');
      expect(config.RESEND_API_KEY).toBeNull();
    });

    test('should throw error when DATABASE_URL is missing', () => {
      delete process.env.DATABASE_URL;
      process.env.CLERK_SECRET_KEY = 'sk_test_123';

      expect(() => validateEnv()).toThrow('Missing required environment variable: DATABASE_URL');
    });

    test('should throw error when CLERK_SECRET_KEY is missing', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      delete process.env.CLERK_SECRET_KEY;

      expect(() => validateEnv()).toThrow('Missing required environment variable: CLERK_SECRET_KEY');
    });

    test('should throw error when multiple required variables are missing', () => {
      delete process.env.DATABASE_URL;
      delete process.env.CLERK_SECRET_KEY;

      expect(() => validateEnv()).toThrow('DATABASE_URL');
      expect(() => validateEnv()).toThrow('CLERK_SECRET_KEY');
    });

    test('should throw error for invalid DATABASE_URL format', () => {
      process.env.DATABASE_URL = 'not-a-valid-url';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';

      expect(() => validateEnv()).toThrow('DATABASE_URL must be a valid PostgreSQL connection string');
    });

    test('should accept postgres:// protocol', () => {
      process.env.DATABASE_URL = 'postgres://localhost:5432/test';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';

      const config = validateEnv();
      expect(config.DATABASE_URL).toBe('postgres://localhost:5432/test');
    });

    test('should accept postgresql:// protocol', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';

      const config = validateEnv();
      expect(config.DATABASE_URL).toBe('postgresql://localhost:5432/test');
    });

    test('should throw error for invalid PORT', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';
      process.env.PORT = 'invalid';

      expect(() => validateEnv()).toThrow('PORT must be a valid port number');
    });

    test('should throw error for PORT out of range (negative)', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';
      process.env.PORT = '-1';

      expect(() => validateEnv()).toThrow('PORT must be a valid port number');
    });

    test('should throw error for PORT out of range (too high)', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';
      process.env.PORT = '70000';

      expect(() => validateEnv()).toThrow('PORT must be a valid port number');
    });

    test('should accept valid PORT', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';
      process.env.PORT = '8080';

      const config = validateEnv();
      expect(config.PORT).toBe(8080);
    });

    test('should use default PORT when not provided', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';
      delete process.env.PORT;

      const config = validateEnv();
      expect(config.PORT).toBe(3001);
    });

    test('should use provided NODE_ENV', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';
      process.env.NODE_ENV = 'production';

      const config = validateEnv();
      expect(config.NODE_ENV).toBe('production');
    });

    test('should use default NODE_ENV when not provided', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';
      delete process.env.NODE_ENV;

      const config = validateEnv();
      expect(config.NODE_ENV).toBe('development');
    });

    test('should include RESEND_API_KEY when provided', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';
      process.env.RESEND_API_KEY = 're_test_123';

      const config = validateEnv();
      expect(config.RESEND_API_KEY).toBe('re_test_123');
    });

    test('should set RESEND_API_KEY to null when not provided', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';
      delete process.env.RESEND_API_KEY;

      const config = validateEnv();
      expect(config.RESEND_API_KEY).toBeNull();
    });
  });
});
