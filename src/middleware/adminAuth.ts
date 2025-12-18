import { clerkClient } from '@clerk/express';
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';

/**
 * Middleware to check if user has admin role
 * Checks publicMetadata.isAdmin from Clerk
 */
export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Fetch user from Clerk to get metadata
    const user = await clerkClient.users.getUser(userId);

    // Check if user has admin flag in public metadata
    if ((user.publicMetadata as { isAdmin?: string })?.isAdmin !== 'true') {
      res.status(403).json({ error: 'Forbidden: Admin access required' });
      return;
    }

    next();
  } catch (error) {
    console.error('Error checking admin status:', error);
    res.status(500).json({ error: 'Failed to verify admin status' });
    return;
  }
}
