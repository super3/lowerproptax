/**
 * Environment variable validation module
 * Validates required environment variables at startup to fail fast
 */

/**
 * Validates that all required environment variables are set
 * @throws {Error} If any required environment variable is missing
 * @returns {Object} Validated environment configuration
 */
export function validateEnv() {
  const errors = [];

  // Required environment variables
  const required = ['DATABASE_URL', 'CLERK_SECRET_KEY'];

  for (const key of required) {
    if (!process.env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  // Validate DATABASE_URL format if present
  if (process.env.DATABASE_URL && !isValidDatabaseUrl(process.env.DATABASE_URL)) {
    errors.push('DATABASE_URL must be a valid PostgreSQL connection string');
  }

  // Validate PORT if present
  if (process.env.PORT) {
    const port = parseInt(process.env.PORT, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push('PORT must be a valid port number (1-65535)');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n  - ${errors.join('\n  - ')}`);
  }

  // Return validated config with defaults
  return {
    DATABASE_URL: process.env.DATABASE_URL,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    PORT: parseInt(process.env.PORT, 10) || 3001,
    NODE_ENV: process.env.NODE_ENV || 'development',
    RESEND_API_KEY: process.env.RESEND_API_KEY || null
  };
}

/**
 * Validates PostgreSQL connection string format
 * @param {string} url - The database URL to validate
 * @returns {boolean} True if valid
 */
function isValidDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:';
  } catch {
    return false;
  }
}

export default validateEnv;
