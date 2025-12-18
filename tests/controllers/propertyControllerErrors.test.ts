import { jest } from '@jest/globals';
import {
  createMockRequest,
  createMockResponse,
  mockUser,
  MockRequest,
  MockResponse
} from '../utils/mockClerk.js';

// Import the controller
const propertyController = await import('../../src/controllers/propertyController.js');

describe('Property Controller - Error Handling', () => {
  let req: MockRequest;
  let res: MockResponse;
  let mockPool: { query: jest.Mock };

  beforeEach(async () => {
    req = createMockRequest({
      user: { id: mockUser.id }
    });
    res = createMockResponse();

    // Get the connection module and create a mock pool that throws errors
    const connectionModule = await import('../../src/db/connection.js');
    mockPool = connectionModule.default as unknown as { query: jest.Mock };
  });

  describe('getProperties - database errors', () => {
    test('should handle database errors gracefully', async () => {
      // Make the pool throw an error
      const originalQuery = mockPool.query;
      mockPool.query = jest.fn().mockRejectedValue(new Error('Database connection failed')) as jest.Mock;

      await propertyController.getProperties(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to get properties' });

      // Restore
      mockPool.query = originalQuery;
    });
  });

  describe('getProperty - database errors', () => {
    test('should handle database errors gracefully', async () => {
      req.params = { id: 'test_id' };

      const originalQuery = mockPool.query;
      mockPool.query = jest.fn().mockRejectedValue(new Error('Database query failed')) as jest.Mock;

      await propertyController.getProperty(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to get property' });

      mockPool.query = originalQuery;
    });
  });

  describe('createProperty - database errors', () => {
    test('should handle database errors gracefully', async () => {
      req.body = { address: '123 Test St' };

      const originalQuery = mockPool.query;
      mockPool.query = jest.fn().mockRejectedValue(new Error('Insert failed')) as jest.Mock;

      await propertyController.createProperty(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to create property' });

      mockPool.query = originalQuery;
    });
  });

  describe('updateProperty - database errors', () => {
    test('should handle database errors gracefully', async () => {
      req.params = { id: 'test_id' };
      req.body = { address: 'Updated Address' };

      const originalQuery = mockPool.query;
      mockPool.query = jest.fn().mockRejectedValue(new Error('Update failed')) as jest.Mock;

      await propertyController.updateProperty(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to update property' });

      mockPool.query = originalQuery;
    });
  });

  describe('deleteProperty - database errors', () => {
    test('should handle database errors gracefully', async () => {
      req.params = { id: 'test_id' };

      const originalQuery = mockPool.query;
      mockPool.query = jest.fn().mockRejectedValue(new Error('Delete failed')) as jest.Mock;

      await propertyController.deleteProperty(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to delete property' });

      mockPool.query = originalQuery;
    });
  });
});
