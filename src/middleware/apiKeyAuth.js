import { clerkClient, verifyToken } from '@clerk/express';
import { requireAdmin } from './adminAuth.js';

/**
 * Middleware that authenticates using Clerk JWT tokens.
 * Verifies the token and attaches user info to req.user.
 */
async function requireClerkAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const sessionToken = authHeader.split(' ')[1];

    try {
      const payload = await verifyToken(sessionToken, {
        secretKey: process.env.CLERK_SECRET_KEY
      });

      const user = await clerkClient.users.getUser(payload.sub);

      req.user = {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        username: user.username
      };

      next();
    } catch (error) {
      console.error('Token verification failed:', error);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

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
  requireClerkAuth(req, res, () => {
    requireAdmin(req, res, next);
  });
}
