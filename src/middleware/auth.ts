import { clerkClient } from '@clerk/express';
import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';

async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No authorization token provided' });
      return;
    }

    const sessionToken = authHeader.split(' ')[1];

    // Verify the session token with Clerk
    try {
      // Decode the JWT to get the session ID
      const tokenParts = sessionToken.split('.');
      if (tokenParts.length !== 3) {
        throw new Error('Invalid token format');
      }

      // Decode the JWT payload
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString()) as { sid?: string; sess?: string; sub?: string };

      // Get the session using the session ID from the token
      const sessionId = payload.sid || payload.sess;
      if (sessionId) {
        const session = await clerkClient.sessions.getSession(sessionId);

        // Get user details
        const user = await clerkClient.users.getUser(session.userId);

        // Attach user to request
        (req as AuthenticatedRequest).user = {
          id: user.id,
          email: user.emailAddresses[0]?.emailAddress,
          username: user.username || undefined
        };

        next();
      } else {
        // If no session ID, try to get user directly from sub claim
        const userId = payload.sub as string;
        const user = await clerkClient.users.getUser(userId);

        // Attach user to request
        (req as AuthenticatedRequest).user = {
          id: user.id,
          email: user.emailAddresses[0]?.emailAddress,
          username: user.username || undefined
        };

        next();
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
    return;
  }
}

export { requireAuth };
