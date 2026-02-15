import { jest } from '@jest/globals';
import { EventEmitter } from 'events';
import express from 'express';
import http from 'http';
import request from 'supertest';

// Mock the database connection
const mockQuery = jest.fn();
jest.unstable_mockModule('../src/db/connection.js', () => ({
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

// Mock email service
jest.unstable_mockModule('../src/services/emailService.js', () => ({
  sendNewPropertyNotification: jest.fn().mockResolvedValue(undefined),
  sendAssessmentReadyNotification: jest.fn().mockResolvedValue(undefined)
}));

// Import after mocking
const adminRoutes = await import('../src/routes/adminRoutes.js');
const propertyRoutes = await import('../src/routes/propertyRoutes.js');
const { addClient, emitEvent, getClientCount } = await import('../src/services/sseManager.js');

const VALID_API_KEY = 'test-sse-api-key';

describe('SSE Event Stream', () => {
  let app;

  beforeEach(() => {
    process.env.SERVICE_API_KEY = VALID_API_KEY;
    app = express();
    app.use(express.json());
    app.use('/api', adminRoutes.default);
    app.use('/api', propertyRoutes.default);
    mockQuery.mockClear();
    mockGetUser.mockClear();
    mockVerifyToken.mockClear();
  });

  afterEach(() => {
    delete process.env.SERVICE_API_KEY;
  });

  describe('GET /api/admin/events', () => {
    test('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/admin/events');

      expect(response.status).toBe(401);
    });

    test('should return 401 with invalid API key', async () => {
      const response = await request(app)
        .get('/api/admin/events')
        .set('x-api-key', 'wrong-key');

      expect(response.status).toBe(401);
    });

    test('should connect with valid API key and return event-stream content type', (done) => {
      const server = app.listen(0, () => {
        const port = server.address().port;

        const req = http.get(
          `http://localhost:${port}/api/admin/events`,
          { headers: { 'x-api-key': VALID_API_KEY } },
          (res) => {
            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toBe('text/event-stream');
            expect(res.headers['cache-control']).toBe('no-cache');

            res.once('data', (chunk) => {
              expect(chunk.toString()).toContain(': connected');
              req.destroy();
              server.close(done);
            });
          }
        );
      });
    }, 10000);

    test('should connect with valid Clerk JWT admin auth', (done) => {
      mockVerifyToken.mockResolvedValue({ sub: 'admin123' });
      mockGetUser.mockResolvedValue({
        id: 'admin123',
        emailAddresses: [{ emailAddress: 'admin@example.com' }],
        username: 'admin',
        publicMetadata: { isAdmin: 'true' }
      });

      const validToken = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'RS256' })).toString('base64') + '.' +
        Buffer.from(JSON.stringify({ sub: 'admin123' })).toString('base64') + '.signature';

      const server = app.listen(0, () => {
        const port = server.address().port;

        const req = http.get(
          `http://localhost:${port}/api/admin/events`,
          { headers: { 'Authorization': `Bearer ${validToken}` } },
          (res) => {
            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toBe('text/event-stream');

            res.once('data', (chunk) => {
              expect(chunk.toString()).toContain(': connected');
              req.destroy();
              server.close(done);
            });
          }
        );
      });
    }, 10000);
  });

  describe('emitEvent', () => {
    test('should not throw when called with zero connected clients', () => {
      expect(() => {
        emitEvent('new-property', { id: 'test-123', address: '123 Main St' });
      }).not.toThrow();
    });

    test('should broadcast new-property event to connected SSE clients', (done) => {
      const receivedData = [];

      const server = app.listen(0, () => {
        const port = server.address().port;

        const req = http.get(
          `http://localhost:${port}/api/admin/events`,
          { headers: { 'x-api-key': VALID_API_KEY } },
          (res) => {
            expect(res.statusCode).toBe(200);

            res.on('data', (chunk) => {
              receivedData.push(chunk.toString());

              // After receiving the connected comment, emit an event
              if (receivedData.length === 1) {
                emitEvent('new-property', {
                  id: 'prop-123',
                  address: '123 Main St',
                  city: 'Atlanta',
                  state: 'GA',
                  zipCode: '30301',
                  createdAt: '2026-02-15T12:00:00.000Z'
                });
              }

              // After receiving the event, verify and close
              if (receivedData.length === 2) {
                const eventChunk = receivedData[1];
                expect(eventChunk).toContain('event: new-property');
                expect(eventChunk).toContain('"id":"prop-123"');
                expect(eventChunk).toContain('"address":"123 Main St"');
                req.destroy();
                server.close(done);
              }
            });
          }
        );
      });
    }, 10000);

    test('should broadcast property-updated event to connected clients', (done) => {
      const receivedData = [];

      const server = app.listen(0, () => {
        const port = server.address().port;

        const req = http.get(
          `http://localhost:${port}/api/admin/events`,
          { headers: { 'x-api-key': VALID_API_KEY } },
          (res) => {
            res.on('data', (chunk) => {
              receivedData.push(chunk.toString());

              if (receivedData.length === 1) {
                emitEvent('property-updated', {
                  id: 'prop-456',
                  address: '456 Oak Ave',
                  status: 'ready',
                  updatedAt: '2026-02-15T13:00:00.000Z'
                });
              }

              if (receivedData.length === 2) {
                const eventChunk = receivedData[1];
                expect(eventChunk).toContain('event: property-updated');
                expect(eventChunk).toContain('"id":"prop-456"');
                expect(eventChunk).toContain('"status":"ready"');
                req.destroy();
                server.close(done);
              }
            });
          }
        );
      });
    }, 10000);
  });

  describe('Admin routes with API key auth', () => {
    test('should allow GET /api/admin/pending-properties with API key', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'prop1', status: 'preparing', user_id: 'user1' }]
      });

      const response = await request(app)
        .get('/api/admin/pending-properties')
        .set('x-api-key', VALID_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'prop1' })
        ])
      );
    });

    test('should allow GET /api/admin/completed-properties with API key', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'prop2', status: 'ready', user_id: 'user2' }]
      });

      const response = await request(app)
        .get('/api/admin/completed-properties')
        .set('x-api-key', VALID_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'prop2' })
        ])
      );
    });

    test('should allow GET /api/admin/properties/:id with API key', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            id: 'prop1', address: '123 Main St', city: 'Atlanta',
            state: 'GA', zipCode: '30301', userId: 'user1'
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 'assess1', year: 2025, annualTax: 5000,
            estimatedAnnualTax: 3375, status: 'preparing'
          }]
        });

      // Mock fetchUserEmailFromClerk (it uses fetch internally)
      global.fetch = jest.fn().mockResolvedValue({
        ok: false
      });

      const response = await request(app)
        .get('/api/admin/properties/prop1')
        .set('x-api-key', VALID_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.objectContaining({ id: 'prop1', address: '123 Main St' })
      );

      delete global.fetch;
    });

    test('should allow PUT /api/admin/properties/:id with API key and handle missing id in response', async () => {
      // This tests the updatedProperty.id || id fallback branch in adminController
      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            // No 'id' field — forces the || id fallback in emitEvent call
            address: '123 Main St', updated_at: '2026-02-15T13:00:00.000Z'
          }]
        })
        .mockResolvedValueOnce({
          rows: [{ year: 2025 }]
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 'assess_prop1_2025', status: 'preparing',
            annual_tax: 5000, estimated_annual_tax: 3375
          }]
        });

      const response = await request(app)
        .put('/api/admin/properties/prop1')
        .set('x-api-key', VALID_API_KEY)
        .send({ bedrooms: 3 });

      expect(response.status).toBe(200);
    });

    test('should allow PUT /api/admin/properties/:id with API key', async () => {
      // Mock property update query
      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            id: 'prop1', address: '123 Main St', updated_at: '2026-02-15T13:00:00.000Z'
          }]
        })
        // Mock latest assessment year query
        .mockResolvedValueOnce({
          rows: [{ year: 2025 }]
        })
        // Mock assessment upsert
        .mockResolvedValueOnce({
          rows: [{
            id: 'assess_prop1_2025', status: 'preparing',
            annual_tax: 5000, estimated_annual_tax: 3375
          }]
        });

      const response = await request(app)
        .put('/api/admin/properties/prop1')
        .set('x-api-key', VALID_API_KEY)
        .send({ bedrooms: 3, bathrooms: 2, sqft: 1500 });

      expect(response.status).toBe(200);
    });
  });

  describe('sseManager unit tests', () => {
    test('getClientCount should return the number of connected clients', () => {
      const mockReq = new EventEmitter();
      const mockRes = {
        writeHead: jest.fn(),
        write: jest.fn()
      };

      const initialCount = getClientCount();
      addClient(mockReq, mockRes);
      expect(getClientCount()).toBe(initialCount + 1);

      // Cleanup: simulate client disconnect
      mockReq.emit('close');
      expect(getClientCount()).toBe(initialCount);
    });

    test('should send keepalive comment every 30 seconds', () => {
      jest.useFakeTimers();

      const mockReq = new EventEmitter();
      const mockRes = {
        writeHead: jest.fn(),
        write: jest.fn()
      };

      addClient(mockReq, mockRes);

      // Initial write is the connected comment
      expect(mockRes.write).toHaveBeenCalledWith(': connected\n\n');
      expect(mockRes.write).toHaveBeenCalledTimes(1);

      // Advance 30 seconds — keepalive should fire
      jest.advanceTimersByTime(30000);
      expect(mockRes.write).toHaveBeenCalledWith(': keepalive\n\n');
      expect(mockRes.write).toHaveBeenCalledTimes(2);

      // Cleanup
      mockReq.emit('close');
      jest.useRealTimers();
    });
  });
});
