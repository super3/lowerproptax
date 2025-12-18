import { jest } from '@jest/globals';
import {
  createMockRequest,
  createMockResponse,
  createMockNext,
  createMockToken,
  createMockClerkClient,
  mockUser,
  mockSession,
  MockRequest,
  MockResponse
} from '../utils/mockClerk.js';

// Mock the Clerk SDK
const mockClerkClient = createMockClerkClient();
jest.unstable_mockModule('@clerk/express', () => ({
  clerkClient: mockClerkClient
}));

// Import the middleware after mocking
const { requireAuth } = await import('../../src/middleware/auth.js');

describe('Authentication Middleware', () => {
  let req: MockRequest;
  let res: MockResponse;
  let next: jest.Mock;

  beforeEach(() => {
    req = createMockRequest();
    res = createMockResponse();
    next = createMockNext();
    jest.clearAllMocks();
  });

  describe('requireAuth', () => {
    test('should return 401 if no authorization header is provided', async () => {
      await requireAuth(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No authorization token provided'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if authorization header does not start with Bearer', async () => {
      req.headers.authorization = 'Basic token123';

      await requireAuth(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No authorization token provided'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if token format is invalid', async () => {
      req.headers.authorization = 'Bearer invalid.token';

      await requireAuth(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should authenticate user with valid token containing session ID', async () => {
      const token = createMockToken({ sid: mockSession.id });
      req.headers.authorization = `Bearer ${token}`;

      await requireAuth(req as any, res as any, next);

      expect(mockClerkClient.sessions.getSession).toHaveBeenCalledWith(mockSession.id);
      expect(mockClerkClient.users.getUser).toHaveBeenCalledWith(mockUser.id);
      expect((req as any).user).toEqual({
        id: mockUser.id,
        email: mockUser.emailAddresses[0].emailAddress,
        username: mockUser.username
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should authenticate user with valid token using sub claim fallback', async () => {
      const token = createMockToken({ sub: mockUser.id, sid: undefined, sess: undefined }); // No session ID
      req.headers.authorization = `Bearer ${token}`;

      await requireAuth(req as any, res as any, next);

      expect(mockClerkClient.users.getUser).toHaveBeenCalledWith(mockUser.id);
      expect((req as any).user).toEqual({
        id: mockUser.id,
        email: mockUser.emailAddresses[0].emailAddress,
        username: mockUser.username
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should return 401 if Clerk session verification fails', async () => {
      mockClerkClient.sessions.getSession.mockRejectedValueOnce(
        new Error('Invalid session')
      );

      const token = createMockToken({ sid: mockSession.id });
      req.headers.authorization = `Bearer ${token}`;

      await requireAuth(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if user retrieval fails', async () => {
      mockClerkClient.users.getUser.mockRejectedValueOnce(
        new Error('User not found')
      );

      const token = createMockToken({ sub: mockUser.id });
      req.headers.authorization = `Bearer ${token}`;

      await requireAuth(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle unexpected errors gracefully', async () => {
      req.headers.authorization = 'Bearer malformed';

      await requireAuth(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle outer try-catch errors with 500', async () => {
      // Create a request object that throws an error when accessing headers
      const errorReq = {
        get headers(): Record<string, string> {
          throw new Error('Unexpected error accessing headers');
        }
      };

      await requireAuth(errorReq as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication error'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle error when getting user via sub claim', async () => {
      // Clear previous mocks
      mockClerkClient.users.getUser.mockClear();

      // Make getUser throw an error for sub claim path
      mockClerkClient.users.getUser.mockRejectedValueOnce(
        new Error('User service unavailable')
      );

      const token = createMockToken({ sub: mockUser.id, sid: undefined, sess: undefined }); // No sid, will use sub
      req.headers.authorization = `Bearer ${token}`;

      await requireAuth(req as any, res as any, next);

      expect(mockClerkClient.users.getUser).toHaveBeenCalledWith(mockUser.id);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
