import { jest } from '@jest/globals';
import {
  createMockRequest,
  createMockResponse,
  mockUser
} from '../utils/mockClerk.js';

// Import the controller
const propertyController = await import('../../src/controllers/propertyController.js');

describe('Property Controller', () => {
  let req, res;

  beforeEach(async () => {
    // Reset properties storage before each test
    await propertyController.resetProperties();

    req = createMockRequest({
      user: { id: mockUser.id }
    });
    res = createMockResponse();
  });

  describe('getProperties', () => {
    test('should return empty array when user has no properties', async () => {
      await propertyController.getProperties(req, res);

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
      await propertyController.createProperty(req, res);
      const userProperty = res.json.mock.calls[0][0];

      // Add property for another user
      const otherUserReq = createMockRequest({
        user: { id: 'user_456' },
        body: property2
      });
      const otherUserRes = createMockResponse();
      await propertyController.createProperty(otherUserReq, otherUserRes);

      // Reset mocks
      res.json.mockClear();

      // Get properties for our user
      await propertyController.getProperties(req, res);

      const properties = res.json.mock.calls[0][0];
      expect(properties).toHaveLength(1);
      expect(properties[0].userId).toBe(mockUser.id);
      expect(properties[0].address).toBe(property1.address);
    });
  });

  describe('getProperty', () => {
    test('should return 404 if property does not exist', async () => {
      req.params = { id: 'nonexistent_id' };

      await propertyController.getProperty(req, res);

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
      await propertyController.createProperty(otherUserReq, otherUserRes);
      const otherProperty = otherUserRes.json.mock.calls[0][0];

      // Try to get it with our user
      req.params = { id: otherProperty.id };

      await propertyController.getProperty(req, res);

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
      await propertyController.createProperty(req, res);
      const property = res.json.mock.calls[0][0];

      // Reset mocks
      res.json.mockClear();

      // Get the property
      req.params = { id: property.id };

      await propertyController.getProperty(req, res);

      expect(res.json).toHaveBeenCalledWith(property);
    });
  });

  describe('createProperty', () => {
    test('should return 400 if address is missing', async () => {
      req.body = { city: 'Atlanta', state: 'GA' };

      await propertyController.createProperty(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Address is required'
      });
    });

    test('should create property with minimal data', async () => {
      req.body = { address: '123 Main St' };

      await propertyController.createProperty(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      const property = res.json.mock.calls[0][0];
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

      await propertyController.createProperty(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      const property = res.json.mock.calls[0][0];
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

      await propertyController.updateProperty(req, res);

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
      await propertyController.createProperty(otherUserReq, otherUserRes);
      const otherProperty = otherUserRes.json.mock.calls[0][0];

      // Try to update it with our user
      req.params = { id: otherProperty.id };
      req.body = { address: 'Hacked Address' };

      await propertyController.updateProperty(req, res);

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
      await propertyController.createProperty(req, res);
      const property = res.json.mock.calls[0][0];

      // Reset mocks
      res.json.mockClear();
      res.status.mockClear();

      // Update the property
      req.params = { id: property.id };
      req.body = {
        address: '456 Oak Ave',
        city: 'Austin',
        state: 'TX'
      };

      await propertyController.updateProperty(req, res);

      const updatedProperty = res.json.mock.calls[0][0];
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
      await propertyController.createProperty(req, res);
      const property = res.json.mock.calls[0][0];

      // Reset mocks
      res.json.mockClear();

      // Update only the city
      req.params = { id: property.id };
      req.body = { city: 'Marietta' };

      await propertyController.updateProperty(req, res);

      const updatedProperty = res.json.mock.calls[0][0];
      expect(updatedProperty.address).toBe('123 Main St'); // unchanged
      expect(updatedProperty.city).toBe('Marietta'); // changed
      expect(updatedProperty.state).toBe('GA'); // unchanged
    });
  });

  describe('deleteProperty', () => {
    test('should return 404 if property does not exist', async () => {
      req.params = { id: 'nonexistent_id' };

      await propertyController.deleteProperty(req, res);

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
      await propertyController.createProperty(otherUserReq, otherUserRes);
      const otherProperty = otherUserRes.json.mock.calls[0][0];

      // Try to delete it with our user
      req.params = { id: otherProperty.id };

      await propertyController.deleteProperty(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access denied'
      });
    });

    test('should delete property if user owns it', async () => {
      // Create property
      req.body = { address: '123 Main St' };
      await propertyController.createProperty(req, res);
      const property = res.json.mock.calls[0][0];

      // Reset mocks
      res.json.mockClear();

      // Delete the property
      req.params = { id: property.id };

      await propertyController.deleteProperty(req, res);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Property deleted successfully'
      });

      // Verify property is deleted
      res.json.mockClear();
      res.status.mockClear();

      await propertyController.getProperty(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
