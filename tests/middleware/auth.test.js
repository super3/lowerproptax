import { jest } from '@jest/globals';
import {
  createMockRequest,
  createMockResponse,
  createMockNext,
  createMockClerkClient,
  mockUser,
  mockSession
} from '../utils/mockClerk.js';

// Mock the Clerk SDK
const mockClerkClient = createMockClerkClient();
const mockVerifyToken = jest.fn();
jest.unstable_mockModule('@clerk/express', () => ({
  clerkClient: mockClerkClient,
  verifyToken: mockVerifyToken
}));

// Import the middleware after mocking
const { requireAuth } = await import('../../src/middleware/auth.js');

describe('Authentication Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = createMockRequest();
    res = createMockResponse();
    next = createMockNext();
    jest.clearAllMocks();

    // Default: verifyToken resolves with a valid payload
    mockVerifyToken.mockResolvedValue({
      sub: mockUser.id,
      sid: mockSession.id
    });
  });

  describe('requireAuth', () => {
    test('should return 401 if no authorization header is provided', async () => {
      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No authorization token provided'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if authorization header does not start with Bearer', async () => {
      req.headers.authorization = 'Basic token123';

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No authorization token provided'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if token verification fails', async () => {
      req.headers.authorization = 'Bearer invalid.token';
      mockVerifyToken.mockRejectedValueOnce(new Error('Invalid token'));

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should authenticate user with valid token', async () => {
      req.headers.authorization = 'Bearer valid.session.token';

      await requireAuth(req, res, next);

      expect(mockVerifyToken).toHaveBeenCalledWith('valid.session.token', {
        secretKey: process.env.CLERK_SECRET_KEY
      });
      expect(mockClerkClient.users.getUser).toHaveBeenCalledWith(mockUser.id);
      expect(req.user).toEqual({
        id: mockUser.id,
        email: mockUser.emailAddresses[0].emailAddress,
        username: mockUser.username
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should return 401 if user retrieval fails', async () => {
      mockClerkClient.users.getUser.mockRejectedValueOnce(
        new Error('User not found')
      );

      req.headers.authorization = 'Bearer valid.session.token';

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle outer try-catch errors with 500', async () => {
      // Create a request object that throws an error when accessing headers
      const errorReq = {
        get headers() {
          throw new Error('Unexpected error accessing headers');
        }
      };

      await requireAuth(errorReq, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication error'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
