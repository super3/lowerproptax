import { clerkClient, verifyToken } from '@clerk/express';

async function requireAuth(req, res, next) {
  try {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const sessionToken = authHeader.split(' ')[1];

    // Verify the token signature and decode the payload
    try {
      const payload = await verifyToken(sessionToken, {
        secretKey: process.env.CLERK_SECRET_KEY
      });

      // Get user details from the verified sub claim
      const user = await clerkClient.users.getUser(payload.sub);

      // Attach user to request
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

export { requireAuth };
