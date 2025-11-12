import { jest } from '@jest/globals';

// Mock the database connection
const mockQuery = jest.fn();
jest.unstable_mockModule('../../src/db/connection.js', () => ({
  default: {
    query: mockQuery
  }
}));

// Import the controller after mocking
const adminController = await import('../../src/controllers/adminController.js');

describe('Admin Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { id: 'admin123' },
      params: {},
      body: {}
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    mockQuery.mockClear();
  });

  describe('getPendingProperties', () => {
    it('should return all pending properties', async () => {
      const mockProperties = [
        {
          id: 'prop1',
          address: '123 Main St',
          city: 'Atlanta',
          state: 'GA',
          zip_code: '30301',
          status: 'preparing',
          created_at: new Date(),
          user_id: 'user1'
        },
        {
          id: 'prop2',
          address: '456 Elm St',
          city: 'Boston',
          state: 'MA',
          zip_code: '02101',
          status: 'preparing',
          created_at: new Date(),
          user_id: 'user2'
        }
      ];

      mockQuery.mockResolvedValue({ rows: mockProperties });

      await adminController.getPendingProperties(req, res);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("WHERE p.status = 'preparing'"));
      expect(res.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'prop1',
            user_email: null
          }),
          expect.objectContaining({
            id: 'prop2',
            user_email: null
          })
        ])
      );
    });

    it('should return empty array when no pending properties exist', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await adminController.getPendingProperties(req, res);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await adminController.getPendingProperties(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch pending properties' });
    });
  });

  describe('getCompletedProperties', () => {
    it('should return all completed properties', async () => {
      const mockProperties = [
        {
          id: 'prop3',
          address: '789 Oak Ave',
          city: 'Chicago',
          state: 'IL',
          zip_code: '60601',
          status: 'ready',
          created_at: new Date(),
          updated_at: new Date(),
          user_id: 'user3'
        }
      ];

      mockQuery.mockResolvedValue({ rows: mockProperties });

      await adminController.getCompletedProperties(req, res);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("WHERE p.status = 'ready'"));
      expect(res.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'prop3',
            user_email: null
          })
        ])
      );
    });

    it('should return empty array when no completed properties exist', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await adminController.getCompletedProperties(req, res);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await adminController.getCompletedProperties(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch completed properties' });
    });
  });

  describe('getPropertyDetails', () => {
    it('should return property details by ID', async () => {
      req.params.id = 'prop1';
      const mockProperty = {
        id: 'prop1',
        address: '123 Main St',
        city: 'Atlanta',
        state: 'GA',
        zip_code: '30301',
        bedrooms: 3,
        bathrooms: 2.5,
        sqft: 1500,
        appraised_value: 250000,
        annual_tax: 5000,
        status: 'preparing',
        created_at: new Date(),
        user_id: 'user1'
      };

      mockQuery.mockResolvedValue({ rows: [mockProperty] });

      await adminController.getPropertyDetails(req, res);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['prop1']
      );
      expect(res.json).toHaveBeenCalledWith(mockProperty);
    });

    it('should return 404 if property does not exist', async () => {
      req.params.id = 'nonexistent';
      mockQuery.mockResolvedValue({ rows: [] });

      await adminController.getPropertyDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Property not found' });
    });

    it('should handle database errors', async () => {
      req.params.id = 'prop1';
      mockQuery.mockRejectedValue(new Error('Database error'));

      await adminController.getPropertyDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch property details' });
    });
  });

  describe('updatePropertyDetails', () => {
    it('should update property details', async () => {
      req.params.id = 'prop1';
      req.body = {
        bedrooms: 4,
        bathrooms: 3.5,
        sqft: 2000,
        appraised_value: 300000
      };

      const mockUpdatedProperty = {
        id: 'prop1',
        bedrooms: 4,
        bathrooms: 3.5,
        sqft: 2000,
        appraised_value: 300000,
        updated_at: new Date()
      };

      mockQuery.mockResolvedValue({ rows: [mockUpdatedProperty] });

      await adminController.updatePropertyDetails(req, res);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE properties'),
        expect.arrayContaining([4, 3.5, 2000, 300000, null, null, 'prop1'])
      );
      expect(res.json).toHaveBeenCalledWith(mockUpdatedProperty);
    });

    it('should handle partial updates', async () => {
      req.params.id = 'prop1';
      req.body = {
        bedrooms: 3
      };

      const mockUpdatedProperty = {
        id: 'prop1',
        bedrooms: 3,
        updated_at: new Date()
      };

      mockQuery.mockResolvedValue({ rows: [mockUpdatedProperty] });

      await adminController.updatePropertyDetails(req, res);

      expect(res.json).toHaveBeenCalledWith(mockUpdatedProperty);
    });

    it('should return 404 if property does not exist', async () => {
      req.params.id = 'nonexistent';
      req.body = { bedrooms: 3 };
      mockQuery.mockResolvedValue({ rows: [] });

      await adminController.updatePropertyDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Property not found' });
    });

    it('should handle database errors', async () => {
      req.params.id = 'prop1';
      req.body = { bedrooms: 3 };
      mockQuery.mockRejectedValue(new Error('Database error'));

      await adminController.updatePropertyDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to update property details' });
    });
  });

  describe('markPropertyAsReady', () => {
    it('should mark property as ready', async () => {
      req.params.id = 'prop1';
      const mockProperty = {
        id: 'prop1',
        address: '123 Main St',
        status: 'ready',
        updated_at: new Date()
      };

      mockQuery.mockResolvedValue({ rows: [mockProperty] });

      await adminController.markPropertyAsReady(req, res);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'ready'"),
        ['prop1']
      );
      expect(res.json).toHaveBeenCalledWith(mockProperty);
    });

    it('should return 404 if property does not exist', async () => {
      req.params.id = 'nonexistent';
      mockQuery.mockResolvedValue({ rows: [] });

      await adminController.markPropertyAsReady(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Property not found' });
    });

    it('should handle database errors', async () => {
      req.params.id = 'prop1';
      mockQuery.mockRejectedValue(new Error('Database error'));

      await adminController.markPropertyAsReady(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to mark property as ready' });
    });
  });
});
