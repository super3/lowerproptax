import { jest } from '@jest/globals';

// Mock Clerk SDK to simulate auth error forwarding
const mockVerifyToken = jest.fn();
jest.unstable_mockModule('@clerk/express', () => ({
  clerkClient: {
    users: {
      getUser: jest.fn()
    }
  },
  verifyToken: mockVerifyToken
}));

jest.unstable_mockModule('../../src/middleware/adminAuth.js', () => ({
  requireAdmin: jest.fn((req, res, next) => next())
}));

const { requireAuthOrApiKey } = await import('../../src/middleware/apiKeyAuth.js');

describe('requireAuthOrApiKey error forwarding', () => {
  test('should forward errors from Clerk auth to next', async () => {
    // Make verifyToken throw an error
    mockVerifyToken.mockRejectedValue(new Error('auth error'));

    const req = {
      headers: {
        authorization: 'Bearer invalid_token'
      }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    await new Promise(resolve => {
      requireAuthOrApiKey(req, res, next);
      setTimeout(resolve, 50);
    });

    // Should return 401 for invalid token
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
  });
});
