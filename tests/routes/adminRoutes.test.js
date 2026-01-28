import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// Mock the database connection
const mockQuery = jest.fn();
jest.unstable_mockModule('../../src/db/connection.js', () => ({
  default: {
    query: mockQuery
  }
}));

// Mock Clerk SDK
const mockGetUser = jest.fn();
const mockGetSession = jest.fn();
jest.unstable_mockModule('@clerk/express', () => ({
  clerkClient: {
    users: {
      getUser: mockGetUser
    },
    sessions: {
      getSession: mockGetSession
    }
  }
}));

// Import routes after mocking
const authModule = await import('../../src/middleware/auth.js');
const adminAuthModule = await import('../../src/middleware/adminAuth.js');
const adminRoutes = await import('../../src/routes/adminRoutes.js');

describe('Admin Routes', () => {
  let app;
  const validToken = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'RS256' })).toString('base64') + '.' +
    Buffer.from(JSON.stringify({ sid: 'session123', sub: 'user123' })).toString('base64') + '.signature';

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', adminRoutes.default);
    mockQuery.mockClear();
    mockGetUser.mockClear();
    mockGetSession.mockClear();
  });

  describe('GET /api/admin/pending-properties', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/admin/pending-properties');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'No authorization token provided' });
    });

    it('should return 403 if user is not admin', async () => {
      mockGetSession.mockResolvedValue({ userId: 'user123' });
      mockGetUser.mockResolvedValue({
        id: 'user123',
        emailAddresses: [{ emailAddress: 'user@example.com' }],
        publicMetadata: { isAdmin: 'false' }
      });

      const response = await request(app)
        .get('/api/admin/pending-properties')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Forbidden: Admin access required' });
    });

    it('should return pending properties if user is admin', async () => {
      const mockProperties = [
        { id: 'prop1', status: 'preparing', user_id: 'user1' }
      ];

      mockGetSession.mockResolvedValue({ userId: 'admin123' });
      mockGetUser.mockResolvedValue({
        id: 'admin123',
        emailAddresses: [{ emailAddress: 'admin@example.com' }],
        publicMetadata: { isAdmin: 'true' }
      });
      mockQuery.mockResolvedValue({ rows: mockProperties });

      const response = await request(app)
        .get('/api/admin/pending-properties')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'prop1' })
        ])
      );
    });
  });

  describe('GET /api/admin/completed-properties', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/admin/completed-properties');

      expect(response.status).toBe(401);
    });

    it('should return completed properties if user is admin', async () => {
      const mockProperties = [
        { id: 'prop2', status: 'ready', user_id: 'user2' }
      ];

      mockGetSession.mockResolvedValue({ userId: 'admin123' });
      mockGetUser.mockResolvedValue({
        id: 'admin123',
        emailAddresses: [{ emailAddress: 'admin@example.com' }],
        publicMetadata: { isAdmin: 'true' }
      });
      mockQuery.mockResolvedValue({ rows: mockProperties });

      const response = await request(app)
        .get('/api/admin/completed-properties')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'prop2' })
        ])
      );
    });
  });
});
