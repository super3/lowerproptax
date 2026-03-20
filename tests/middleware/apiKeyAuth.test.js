import { jest } from '@jest/globals';
import {
  createMockRequest,
  createMockResponse,
  createMockNext,
  createMockClerkClient,
  mockUser,
} from '../utils/mockClerk.js';

// Mock the Clerk SDK
const mockClerkClient = createMockClerkClient();
const mockVerifyToken = jest.fn();
jest.unstable_mockModule('@clerk/express', () => ({
  clerkClient: mockClerkClient,
  verifyToken: mockVerifyToken
}));

// Import the middleware after mocking
const { requireApiKey, requireAuthOrApiKey } = await import('../../src/middleware/apiKeyAuth.js');

describe('API Key Authentication Middleware', () => {
  let req, res, next;
  const VALID_API_KEY = 'test-service-api-key-123';

  beforeEach(() => {
    req = createMockRequest();
    res = createMockResponse();
    next = createMockNext();
    jest.clearAllMocks();
    process.env.SERVICE_API_KEY = VALID_API_KEY;

    // Default: verifyToken resolves with a valid payload
    mockVerifyToken.mockResolvedValue({
      sub: mockUser.id,
    });
  });

  afterEach(() => {
    delete process.env.SERVICE_API_KEY;
  });

  describe('requireApiKey', () => {
    test('should return 401 if no x-api-key header is provided', () => {
      requireApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid API key' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if x-api-key header is invalid', () => {
      req.headers['x-api-key'] = 'wrong-key';

      requireApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid API key' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should authenticate with valid API key and set req.user', () => {
      req.headers['x-api-key'] = VALID_API_KEY;

      requireApiKey(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual({
        id: 'service:claw',
        email: null,
        username: 'claw'
      });
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('requireAuthOrApiKey', () => {
    test('should use API key auth when x-api-key header is present', () => {
      req.headers['x-api-key'] = VALID_API_KEY;

      requireAuthOrApiKey(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual({
        id: 'service:claw',
        email: null,
        username: 'claw'
      });
    });

    test('should return 401 with invalid API key even if x-api-key header is present', () => {
      req.headers['x-api-key'] = 'wrong-key';

      requireAuthOrApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid API key' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should fall through to Clerk auth when no x-api-key header', async () => {
      // No x-api-key header, no Bearer token either
      requireAuthOrApiKey(req, res, next);

      // Wait for async Clerk auth to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No authorization token provided' });
    });

    test('should authenticate via Clerk JWT when no x-api-key but valid Bearer token', async () => {
      req.headers.authorization = 'Bearer valid.session.token';

      // Mock admin check
      mockClerkClient.users.getUser.mockResolvedValue({
        id: mockUser.id,
        emailAddresses: [{ emailAddress: 'admin@example.com' }],
        username: 'admin',
        publicMetadata: { isAdmin: 'true' }
      });

      requireAuthOrApiKey(req, res, next);

      // Wait for async Clerk auth + admin check to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockVerifyToken).toHaveBeenCalledWith('valid.session.token', {
        secretKey: process.env.CLERK_SECRET_KEY
      });
      expect(next).toHaveBeenCalled();
    });

    test('should return 500 when auth middleware encounters unexpected error', async () => {
      // Make headers throw to trigger outer catch
      const badReq = {
        headers: Object.create(null, {
          authorization: { get() { throw new Error('unexpected'); } },
          'x-api-key': { value: undefined }
        })
      };
      // Use a proxy to simulate error on header access
      const proxyReq = new Proxy(req, {
        get(target, prop) {
          if (prop === 'headers') {
            return new Proxy({}, {
              get(t, p) {
                if (p === 'x-api-key') return undefined;
                if (p === 'authorization') throw new Error('unexpected header error');
                return undefined;
              }
            });
          }
          return target[prop];
        }
      });

      requireAuthOrApiKey(proxyReq, res, next);
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication error' });
    });

    test('should return 403 via Clerk auth when user is not admin', async () => {
      req.headers.authorization = 'Bearer valid.session.token';

      // Mock non-admin user
      mockClerkClient.users.getUser.mockResolvedValue({
        id: mockUser.id,
        emailAddresses: [{ emailAddress: 'user@example.com' }],
        username: 'user',
        publicMetadata: { isAdmin: 'false' }
      });

      requireAuthOrApiKey(req, res, next);

      // Wait for async auth + admin check
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
