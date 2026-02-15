import { requireAuth } from './auth.js';
import { requireAdmin } from './adminAuth.js';

/**
 * Middleware that authenticates using the x-api-key header.
 * Validates against process.env.SERVICE_API_KEY.
 */
export function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== process.env.SERVICE_API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Set req.user so downstream code that expects it still works
  req.user = { id: 'service:claw', email: null, username: 'claw' };
  next();
}

/**
 * Combined auth middleware: if x-api-key header is present, use API key auth
 * (which implies admin). Otherwise fall through to Clerk auth + admin check.
 */
export function requireAuthOrApiKey(req, res, next) {
  if (req.headers['x-api-key']) {
    return requireApiKey(req, res, next);
  }

  // Fall through to Clerk auth, then admin check
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    requireAdmin(req, res, next);
  });
}
