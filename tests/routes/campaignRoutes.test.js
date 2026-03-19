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
const mockVerifyToken = jest.fn();
jest.unstable_mockModule('@clerk/express', () => ({
  clerkClient: {
    users: {
      getUser: mockGetUser
    }
  },
  verifyToken: mockVerifyToken
}));

// Import routes after mocking
const campaignRoutes = await import('../../src/routes/campaignRoutes.js');

const VALID_API_KEY = 'test-campaign-api-key';

describe('Campaign Routes', () => {
  let app;

  beforeEach(() => {
    process.env.SERVICE_API_KEY = VALID_API_KEY;
    app = express();
    app.use(express.json());
    app.use('/api', campaignRoutes.default);
    mockQuery.mockClear();
    mockGetUser.mockClear();
    mockVerifyToken.mockClear();
  });

  afterEach(() => {
    delete process.env.SERVICE_API_KEY;
  });

  describe('GET /api/admin/campaigns', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/admin/campaigns');
      expect(response.status).toBe(401);
    });

    it('should return campaigns with valid API key', async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: 'camp_1', name: 'Test' }] });

      const response = await request(app)
        .get('/api/admin/campaigns')
        .set('x-api-key', VALID_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([{ id: 'camp_1', name: 'Test' }]);
    });
  });

  describe('POST /api/admin/campaigns', () => {
    it('should create a campaign with valid API key', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'camp_1', name: 'Aria Feb 2026', county: 'Fulton', state: 'GA' }]
      });

      const response = await request(app)
        .post('/api/admin/campaigns')
        .set('x-api-key', VALID_API_KEY)
        .send({ name: 'Aria Feb 2026', county: 'Fulton', state: 'GA' });

      expect(response.status).toBe(201);
    });
  });

  describe('GET /api/admin/campaigns/:id', () => {
    it('should return campaign details with valid API key', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'camp_1', name: 'Test' }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/admin/campaigns/camp_1')
        .set('x-api-key', VALID_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({ id: 'camp_1', recipients: [] }));
    });
  });

  describe('POST /api/admin/campaigns/:id/recipients', () => {
    it('should add a recipient with valid API key', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'camp_1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'mail_1', shortCode: '123m' }] });

      const response = await request(app)
        .post('/api/admin/campaigns/camp_1/recipients')
        .set('x-api-key', VALID_API_KEY)
        .send({ recipientName: 'Test User', address: '123 Main St' });

      expect(response.status).toBe(201);
    });
  });

  describe('PUT /api/admin/campaigns/:id/recipients/:recipientId', () => {
    it('should update a recipient with valid API key', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'mail_1', shortCode: '123m', recipientName: 'Updated' }]
      });

      const response = await request(app)
        .put('/api/admin/campaigns/camp_1/recipients/mail_1')
        .set('x-api-key', VALID_API_KEY)
        .send({ recipientName: 'Updated' });

      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/admin/campaigns/:id/recipients/:recipientId', () => {
    it('should delete a recipient with valid API key', async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: 'mail_1' }] });

      const response = await request(app)
        .delete('/api/admin/campaigns/camp_1/recipients/mail_1')
        .set('x-api-key', VALID_API_KEY);

      expect(response.status).toBe(200);
    });
  });
});
