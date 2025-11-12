import { jest } from '@jest/globals';

// Mock Clerk SDK
const mockGetUser = jest.fn();
jest.unstable_mockModule('@clerk/clerk-sdk-node', () => ({
  clerkClient: {
    users: {
      getUser: mockGetUser
    }
  }
}));

// Import the middleware after mocking
const { requireAdmin } = await import('../../src/middleware/adminAuth.js');

describe('Admin Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { id: 'user123' }
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    mockGetUser.mockClear();
  });

  describe('requireAdmin', () => {
    it('should return 401 if user is not authenticated', async () => {
      req.user = null;

      await requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if user object has no id', async () => {
      req.user = {};

      await requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() if user is admin', async () => {
      mockGetUser.mockResolvedValue({
        id: 'user123',
        publicMetadata: {
          isAdmin: 'true'
        }
      });

      await requireAdmin(req, res, next);

      expect(mockGetUser).toHaveBeenCalledWith('user123');
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 403 if user is not admin', async () => {
      mockGetUser.mockResolvedValue({
        id: 'user123',
        publicMetadata: {
          isAdmin: 'false'
        }
      });

      await requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden: Admin access required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if user has no publicMetadata', async () => {
      mockGetUser.mockResolvedValue({
        id: 'user123'
      });

      await requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden: Admin access required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if publicMetadata has no isAdmin field', async () => {
      mockGetUser.mockResolvedValue({
        id: 'user123',
        publicMetadata: {}
      });

      await requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden: Admin access required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle errors from Clerk API', async () => {
      mockGetUser.mockRejectedValue(new Error('Clerk API error'));

      await requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to verify admin status' });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
