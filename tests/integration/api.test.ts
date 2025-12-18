import { jest } from '@jest/globals';
import request from 'supertest';
import {
  createMockToken,
  createMockClerkClient,
  mockUser,
  mockSession
} from '../utils/mockClerk.js';

// Mock the Clerk SDK before importing anything else
const mockClerkClient = createMockClerkClient();
jest.unstable_mockModule('@clerk/express', () => ({
  clerkClient: mockClerkClient
}));

// Import after mocking
const { createTestServer } = await import('../utils/testServer.js');
const propertyController = await import('../../src/controllers/propertyController.js');

describe('Property API Integration Tests', () => {
  let app: ReturnType<typeof createTestServer>;
  let validToken: string;

  beforeAll(() => {
    app = createTestServer();
    validToken = createMockToken({ sid: mockSession.id });
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset property storage before each test
    await propertyController.resetProperties();
  });

  describe('POST /api/properties', () => {
    test('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/properties')
        .send({ address: '123 Main St' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('No authorization token provided');
    });

    test('should create property with valid authentication', async () => {
      const propertyData = {
        address: '123 Main St',
        city: 'Atlanta',
        state: 'GA',
        zipCode: '30301'
      };

      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${validToken}`)
        .send(propertyData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        address: propertyData.address,
        city: propertyData.city,
        state: propertyData.state,
        zipCode: propertyData.zipCode,
        userId: mockUser.id
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.createdAt).toBeDefined();
    });

    test('should return 400 if address is missing', async () => {
      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ city: 'Atlanta' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Address is required');
    });
  });

  describe('GET /api/properties', () => {
    test('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/properties');

      expect(response.status).toBe(401);
    });

    test('should return empty array when no properties exist', async () => {
      const response = await request(app)
        .get('/api/properties')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    test('should return user properties', async () => {
      // Create a property first
      const createResponse = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          address: '123 Main St',
          city: 'Atlanta',
          state: 'GA'
        });

      const property = createResponse.body;

      // Get all properties
      const response = await request(app)
        .get('/api/properties')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject(property);
    });

    test('should only return properties for authenticated user', async () => {
      // Create property for user 1
      await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ address: '123 Main St' });

      // Create token for user 2
      const user2Token = createMockToken({
        sub: 'user_456',
        sid: 'sess_456'
      });

      mockClerkClient.sessions.getSession.mockResolvedValueOnce({
        id: 'sess_456',
        userId: 'user_456'
      });

      mockClerkClient.users.getUser.mockResolvedValueOnce({
        id: 'user_456',
        emailAddresses: [{ emailAddress: 'user2@example.com' }],
        username: 'user2'
      });

      // Create property for user 2
      await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ address: '456 Oak Ave' });

      // Get properties for user 1
      const response = await request(app)
        .get('/api/properties')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].address).toBe('123 Main St');
    });
  });

  describe('GET /api/properties/:id', () => {
    test('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/properties/prop_123');

      expect(response.status).toBe(401);
    });

    test('should return 404 if property does not exist', async () => {
      const response = await request(app)
        .get('/api/properties/nonexistent_id')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Property not found');
    });

    test('should return property if it exists and user owns it', async () => {
      // Create property
      const createResponse = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ address: '123 Main St' });

      const property = createResponse.body;

      // Get the property
      const response = await request(app)
        .get(`/api/properties/${property.id}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject(property);
    });

    test('should return 403 if user does not own the property', async () => {
      // Create property for user 1
      const createResponse = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ address: '123 Main St' });

      const property = createResponse.body;

      // Try to get it as user 2
      const user2Token = createMockToken({
        sub: 'user_456',
        sid: 'sess_456'
      });

      mockClerkClient.sessions.getSession.mockResolvedValueOnce({
        id: 'sess_456',
        userId: 'user_456'
      });

      mockClerkClient.users.getUser.mockResolvedValueOnce({
        id: 'user_456',
        emailAddresses: [{ emailAddress: 'user2@example.com' }],
        username: 'user2'
      });

      const response = await request(app)
        .get(`/api/properties/${property.id}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('PUT /api/properties/:id', () => {
    test('should return 401 without authentication', async () => {
      const response = await request(app)
        .put('/api/properties/prop_123')
        .send({ address: 'Updated Address' });

      expect(response.status).toBe(401);
    });

    test('should update property if user owns it', async () => {
      // Create property
      const createResponse = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          address: '123 Main St',
          city: 'Atlanta',
          state: 'GA'
        });

      const property = createResponse.body;

      // Update it
      const response = await request(app)
        .put(`/api/properties/${property.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          city: 'Marietta',
          state: 'GA'
        });

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(property.id);
      expect(response.body.address).toBe('123 Main St'); // unchanged
      expect(response.body.city).toBe('Marietta'); // changed
    });

    test('should return 403 if user does not own the property', async () => {
      // Create property for user 1
      const createResponse = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ address: '123 Main St' });

      const property = createResponse.body;

      // Try to update as user 2
      const user2Token = createMockToken({
        sub: 'user_456',
        sid: 'sess_456'
      });

      mockClerkClient.sessions.getSession.mockResolvedValueOnce({
        id: 'sess_456',
        userId: 'user_456'
      });

      mockClerkClient.users.getUser.mockResolvedValueOnce({
        id: 'user_456',
        emailAddresses: [{ emailAddress: 'user2@example.com' }],
        username: 'user2'
      });

      const response = await request(app)
        .put(`/api/properties/${property.id}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ address: 'Hacked Address' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('DELETE /api/properties/:id', () => {
    test('should return 401 without authentication', async () => {
      const response = await request(app).delete('/api/properties/prop_123');

      expect(response.status).toBe(401);
    });

    test('should delete property if user owns it', async () => {
      // Create property
      const createResponse = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ address: '123 Main St' });

      const property = createResponse.body;

      // Delete it
      const response = await request(app)
        .delete(`/api/properties/${property.id}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Property deleted successfully');

      // Verify it's deleted
      const getResponse = await request(app)
        .get(`/api/properties/${property.id}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(getResponse.status).toBe(404);
    });

    test('should return 403 if user does not own the property', async () => {
      // Create property for user 1
      const createResponse = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ address: '123 Main St' });

      const property = createResponse.body;

      // Try to delete as user 2
      const user2Token = createMockToken({
        sub: 'user_456',
        sid: 'sess_456'
      });

      mockClerkClient.sessions.getSession.mockResolvedValueOnce({
        id: 'sess_456',
        userId: 'user_456'
      });

      mockClerkClient.users.getUser.mockResolvedValueOnce({
        id: 'user_456',
        emailAddresses: [{ emailAddress: 'user2@example.com' }],
        username: 'user2'
      });

      const response = await request(app)
        .delete(`/api/properties/${property.id}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });
  });
});
