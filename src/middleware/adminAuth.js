import { clerkClient } from '@clerk/clerk-sdk-node';

/**
 * Middleware to check if user has admin role
 * Checks publicMetadata.isAdmin from Clerk
 */
export async function requireAdmin(req, res, next) {
  try {
    const userId = req.auth.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch user from Clerk to get metadata
    const user = await clerkClient.users.getUser(userId);

    // Check if user has admin flag in public metadata
    if (user.publicMetadata?.isAdmin !== 'true') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Error checking admin status:', error);
    return res.status(500).json({ error: 'Failed to verify admin status' });
  }
}
