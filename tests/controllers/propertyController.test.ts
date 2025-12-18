import { jest } from '@jest/globals';
import {
  createMockRequest,
  createMockResponse,
  mockUser,
  MockRequest,
  MockResponse
} from '../utils/mockClerk.js';
import { addMockAssessment, clearMockAssessments } from '../utils/mockDatabase.js';

// Import the controller
const propertyController = await import('../../src/controllers/propertyController.js');

describe('Property Controller', () => {
  let req: MockRequest;
  let res: MockResponse;

  beforeEach(async () => {
    // Reset properties storage before each test
    await propertyController.resetProperties();
    clearMockAssessments();

    req = createMockRequest({
      user: { id: mockUser.id }
    });
    res = createMockResponse();
  });

  describe('getProperties', () => {
    test('should return empty array when user has no properties', async () => {
      await propertyController.getProperties(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    test('should return only the authenticated user\'s properties', async () => {
      // Create properties for different users
      const property1 = {
        address: '123 Main St',
        city: 'Atlanta',
        state: 'GA',
        zipCode: '30301'
      };

      const property2 = {
        address: '456 Oak Ave',
        city: 'Austin',
        state: 'TX',
        zipCode: '73301'
      };

      // Add property for our user
      req.body = property1;
      await propertyController.createProperty(req as any, res as any);
      const userProperty = (res.json as jest.Mock).mock.calls[0][0];

      // Add property for another user
      const otherUserReq = createMockRequest({
        user: { id: 'user_456' },
        body: property2
      });
      const otherUserRes = createMockResponse();
      await propertyController.createProperty(otherUserReq as any, otherUserRes as any);

      // Reset mocks
      (res.json as jest.Mock).mockClear();

      // Get properties for our user
      await propertyController.getProperties(req as any, res as any);

      const properties = (res.json as jest.Mock).mock.calls[0][0];
      expect(properties).toHaveLength(1);
      expect(properties[0].userId).toBe(mockUser.id);
      expect(properties[0].address).toBe(property1.address);
    });

    test('should return properties with their latest assessment', async () => {
      // Create a property
      req.body = {
        address: '789 Pine St',
        city: 'Denver',
        state: 'CO',
        zipCode: '80201'
      };
      await propertyController.createProperty(req as any, res as any);
      const createdProperty = (res.json as jest.Mock).mock.calls[0][0];

      // Add an assessment for this property
      addMockAssessment(createdProperty.id, {
        id: 'assess_123',
        year: 2024,
        appraisedValue: 350000,
        annualTax: 7000,
        estimatedAppraisedValue: 320000,
        estimatedAnnualTax: 6400,
        reportUrl: 'https://example.com/report.pdf',
        status: 'ready',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Reset mocks and get properties
      (res.json as jest.Mock).mockClear();
      await propertyController.getProperties(req as any, res as any);

      const properties = (res.json as jest.Mock).mock.calls[0][0];
      expect(properties).toHaveLength(1);
      expect(properties[0].latestAssessment).not.toBeNull();
      expect(properties[0].latestAssessment.id).toBe('assess_123');
      expect(properties[0].latestAssessment.year).toBe(2024);
      expect(properties[0].latestAssessment.appraisedValue).toBe(350000);
      expect(properties[0].latestAssessment.status).toBe('ready');
    });
  });

  describe('getProperty', () => {
    test('should return 404 if property does not exist', async () => {
      req.params = { id: 'nonexistent_id' };

      await propertyController.getProperty(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Property not found'
      });
    });

    test('should return 403 if user does not own the property', async () => {
      // Create property for another user
      const otherUserReq = createMockRequest({
        user: { id: 'user_456' },
        body: {
          address: '789 Pine St',
          city: 'Denver',
          state: 'CO'
        }
      });
      const otherUserRes = createMockResponse();
      await propertyController.createProperty(otherUserReq as any, otherUserRes as any);
      const otherProperty = (otherUserRes.json as jest.Mock).mock.calls[0][0];

      // Try to get it with our user
      req.params = { id: otherProperty.id };

      await propertyController.getProperty(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access denied'
      });
    });

    test('should return property if user owns it', async () => {
      // Create property
      req.body = {
        address: '123 Main St',
        city: 'Atlanta',
        state: 'GA'
      };
      await propertyController.createProperty(req as any, res as any);
      const property = (res.json as jest.Mock).mock.calls[0][0];

      // Reset mocks
      (res.json as jest.Mock).mockClear();

      // Get the property
      req.params = { id: property.id };

      await propertyController.getProperty(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith(property);
    });
  });

  describe('createProperty', () => {
    test('should return 400 if address is missing', async () => {
      req.body = { city: 'Atlanta', state: 'GA' };

      await propertyController.createProperty(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Address is required'
      });
    });

    test('should create property with minimal data', async () => {
      req.body = { address: '123 Main St' };

      await propertyController.createProperty(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(201);
      const property = (res.json as jest.Mock).mock.calls[0][0];
      expect(property.id).toBeDefined();
      expect(property.userId).toBe(mockUser.id);
      expect(property.address).toBe('123 Main St');
      expect(property.city).toBe('');
      expect(property.state).toBe('');
      expect(property.zipCode).toBe('');
      expect(property.createdAt).toBeDefined();
      expect(property.updatedAt).toBeDefined();
    });

    test('should create property with full data', async () => {
      req.body = {
        address: '123 Main St',
        city: 'Atlanta',
        state: 'GA',
        zipCode: '30301',
        country: 'United States',
        lat: 33.7490,
        lng: -84.3880
      };

      await propertyController.createProperty(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(201);
      const property = (res.json as jest.Mock).mock.calls[0][0];
      expect(property.address).toBe('123 Main St');
      expect(property.city).toBe('Atlanta');
      expect(property.state).toBe('GA');
      expect(property.zipCode).toBe('30301');
      expect(property.country).toBe('United States');
      expect(property.lat).toBe(33.7490);
      expect(property.lng).toBe(-84.3880);
    });
  });

  describe('updateProperty', () => {
    test('should return 404 if property does not exist', async () => {
      req.params = { id: 'nonexistent_id' };
      req.body = { address: 'Updated Address' };

      await propertyController.updateProperty(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Property not found'
      });
    });

    test('should return 403 if user does not own the property', async () => {
      // Create property for another user
      const otherUserReq = createMockRequest({
        user: { id: 'user_456' },
        body: { address: '789 Pine St' }
      });
      const otherUserRes = createMockResponse();
      await propertyController.createProperty(otherUserReq as any, otherUserRes as any);
      const otherProperty = (otherUserRes.json as jest.Mock).mock.calls[0][0];

      // Try to update it with our user
      req.params = { id: otherProperty.id };
      req.body = { address: 'Hacked Address' };

      await propertyController.updateProperty(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access denied'
      });
    });

    test('should update property if user owns it', async () => {
      // Create property
      req.body = {
        address: '123 Main St',
        city: 'Atlanta',
        state: 'GA'
      };
      await propertyController.createProperty(req as any, res as any);
      const property = (res.json as jest.Mock).mock.calls[0][0];

      // Reset mocks
      (res.json as jest.Mock).mockClear();
      (res.status as jest.Mock).mockClear();

      // Update the property
      req.params = { id: property.id };
      req.body = {
        address: '456 Oak Ave',
        city: 'Austin',
        state: 'TX'
      };

      await propertyController.updateProperty(req as any, res as any);

      const updatedProperty = (res.json as jest.Mock).mock.calls[0][0];
      expect(updatedProperty.id).toBe(property.id);
      expect(updatedProperty.address).toBe('456 Oak Ave');
      expect(updatedProperty.city).toBe('Austin');
      expect(updatedProperty.state).toBe('TX');
      expect(updatedProperty.updatedAt).toBeDefined();
    });

    test('should partially update property', async () => {
      // Create property
      req.body = {
        address: '123 Main St',
        city: 'Atlanta',
        state: 'GA'
      };
      await propertyController.createProperty(req as any, res as any);
      const property = (res.json as jest.Mock).mock.calls[0][0];

      // Reset mocks
      (res.json as jest.Mock).mockClear();

      // Update only the city
      req.params = { id: property.id };
      req.body = { city: 'Marietta' };

      await propertyController.updateProperty(req as any, res as any);

      const updatedProperty = (res.json as jest.Mock).mock.calls[0][0];
      expect(updatedProperty.address).toBe('123 Main St'); // unchanged
      expect(updatedProperty.city).toBe('Marietta'); // changed
      expect(updatedProperty.state).toBe('GA'); // unchanged
    });

    test('should update all property fields including country and coordinates', async () => {
      // Create property with minimal data
      req.body = { address: '123 Main St' };
      await propertyController.createProperty(req as any, res as any);
      const property = (res.json as jest.Mock).mock.calls[0][0];

      // Reset mocks
      (res.json as jest.Mock).mockClear();

      // Update with all fields including country, lat, lng, zipCode
      req.params = { id: property.id };
      req.body = {
        address: '456 Oak Ave',
        city: 'Paris',
        state: 'Île-de-France',
        zipCode: '75001',
        country: 'France',
        lat: 48.8566,
        lng: 2.3522
      };

      await propertyController.updateProperty(req as any, res as any);

      const updatedProperty = (res.json as jest.Mock).mock.calls[0][0];
      expect(updatedProperty.address).toBe('456 Oak Ave');
      expect(updatedProperty.city).toBe('Paris');
      expect(updatedProperty.state).toBe('Île-de-France');
      expect(updatedProperty.zipCode).toBe('75001');
      expect(updatedProperty.country).toBe('France');
      expect(updatedProperty.lat).toBe(48.8566);
      expect(updatedProperty.lng).toBe(2.3522);
    });

    test('should handle explicit null values in update', async () => {
      // Create property with full data
      req.body = {
        address: '123 Main St',
        city: 'Atlanta',
        state: 'GA',
        zipCode: '30301',
        country: 'USA',
        lat: 33.7490,
        lng: -84.3880
      };
      await propertyController.createProperty(req as any, res as any);
      const property = (res.json as jest.Mock).mock.calls[0][0];

      // Reset mocks
      (res.json as jest.Mock).mockClear();

      // Update with explicit null
      req.params = { id: property.id };
      req.body = {
        city: null
      };

      await propertyController.updateProperty(req as any, res as any);

      const updatedProperty = (res.json as jest.Mock).mock.calls[0][0];
      // When we pass null, COALESCE will fall back to existing value (null is not considered a value)
      // So the city should remain 'Atlanta' (unchanged)
      expect(updatedProperty.city).toBe('Atlanta');
      expect(updatedProperty.address).toBe('123 Main St'); // unchanged
    });

    test('should handle empty string values in update', async () => {
      // Create property
      req.body = { address: '123 Main St', city: 'Atlanta' };
      await propertyController.createProperty(req as any, res as any);
      const property = (res.json as jest.Mock).mock.calls[0][0];

      // Reset mocks
      (res.json as jest.Mock).mockClear();

      // Update with empty string (which !== undefined, so it should be used)
      req.params = { id: property.id };
      req.body = {
        city: ''
      };

      await propertyController.updateProperty(req as any, res as any);

      const updatedProperty = (res.json as jest.Mock).mock.calls[0][0];
      expect(updatedProperty.city).toBe('');
    });
  });

  describe('deleteProperty', () => {
    test('should return 404 if property does not exist', async () => {
      req.params = { id: 'nonexistent_id' };

      await propertyController.deleteProperty(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Property not found'
      });
    });

    test('should return 403 if user does not own the property', async () => {
      // Create property for another user
      const otherUserReq = createMockRequest({
        user: { id: 'user_456' },
        body: { address: '789 Pine St' }
      });
      const otherUserRes = createMockResponse();
      await propertyController.createProperty(otherUserReq as any, otherUserRes as any);
      const otherProperty = (otherUserRes.json as jest.Mock).mock.calls[0][0];

      // Try to delete it with our user
      req.params = { id: otherProperty.id };

      await propertyController.deleteProperty(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access denied'
      });
    });

    test('should delete property if user owns it', async () => {
      // Create property
      req.body = { address: '123 Main St' };
      await propertyController.createProperty(req as any, res as any);
      const property = (res.json as jest.Mock).mock.calls[0][0];

      // Reset mocks
      (res.json as jest.Mock).mockClear();

      // Delete the property
      req.params = { id: property.id };

      await propertyController.deleteProperty(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Property deleted successfully'
      });

      // Verify property is deleted
      (res.json as jest.Mock).mockClear();
      (res.status as jest.Mock).mockClear();

      await propertyController.getProperty(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
