import { jest } from '@jest/globals';

// Mock auth.js to export a requireAuth that calls next(err)
// This tests the defensive error-forwarding branch in requireAuthOrApiKey
jest.unstable_mockModule('../../src/middleware/auth.js', () => ({
  requireAuth: jest.fn((req, res, next) => {
    next(new Error('auth error'));
  })
}));

jest.unstable_mockModule('../../src/middleware/adminAuth.js', () => ({
  requireAdmin: jest.fn((req, res, next) => next())
}));

jest.unstable_mockModule('@clerk/express', () => ({
  clerkClient: { users: { getUser: jest.fn() } },
  verifyToken: jest.fn()
}));

const { requireAuthOrApiKey } = await import('../../src/middleware/apiKeyAuth.js');

describe('requireAuthOrApiKey error forwarding', () => {
  test('should forward errors from requireAuth to next', () => {
    const req = { headers: {} }; // No x-api-key header triggers Clerk auth path
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    requireAuthOrApiKey(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe('auth error');
  });
});
