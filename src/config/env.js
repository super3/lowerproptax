import { z } from 'zod';

/**
 * Environment variable schema - validates and provides defaults
 * Fail fast: If required variables are missing, the server won't start
 */
const envSchema = z.object({
  // Database (required)
  DATABASE_URL: z.string({
    required_error: 'DATABASE_URL is required - set it to your PostgreSQL connection string',
  }).url('DATABASE_URL must be a valid URL'),

  // Server configuration
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Clerk Authentication (required)
  CLERK_SECRET_KEY: z.string({
    required_error: 'CLERK_SECRET_KEY is required for authentication',
  }).min(1, 'CLERK_SECRET_KEY cannot be empty'),

  // Email service (optional - gracefully disabled if not set)
  RESEND_API_KEY: z.string().optional(),
});

/**
 * Validate environment variables at startup
 * @returns Validated and typed environment variables
 * @throws ZodError if validation fails
 */
export function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Environment variable validation failed:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    console.error('\nPlease check your .env file or environment configuration.');
    process.exit(1);
  }

  return result.data;
}

export default envSchema;
