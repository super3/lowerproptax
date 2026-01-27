import { jest } from '@jest/globals';

// Mock the database connection
const mockQuery = jest.fn();
jest.unstable_mockModule('../../src/db/connection.js', () => ({
  default: {
    query: mockQuery
  }
}));

// Mock the email service
jest.unstable_mockModule('../../src/services/emailService.js', () => ({
  sendNewPropertyNotification: jest.fn()
}));

// Mock the address parser
const mockParseAddress = jest.fn();
const MOCK_SUPPORTED_COUNTIES = ['fulton', 'gwinnett', 'cobb'];
jest.unstable_mockModule('../../scripts/address-parser.js', () => ({
  parseAddress: mockParseAddress,
  SUPPORTED_COUNTIES: MOCK_SUPPORTED_COUNTIES
}));

// Import the controller after mocking
const propertyController = await import('../../src/controllers/propertyController.js');

describe('previewProperty', () => {
  let req, res;
  const originalEnv = process.env;

  beforeEach(() => {
    req = {
      body: {}
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    mockParseAddress.mockClear();
    process.env = { ...originalEnv, GOOGLE_MAPS_API_KEY: 'test-api-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return 400 if address is missing', async () => {
    req.body = {};

    await propertyController.previewProperty(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Address is required' });
  });

  it('should return 500 if Google Maps API key is not configured', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    req.body = { address: '123 Main St, Atlanta, GA' };

    await propertyController.previewProperty(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Google Maps API key not configured' });
  });

  it('should return preview data for supported county', async () => {
    req.body = { address: '123 Main St, Atlanta, GA 30301' };
    mockParseAddress.mockResolvedValue({
      streetAddress: '123 Main St',
      county: 'fulton',
      isSupported: true,
      raw: {}
    });

    await propertyController.previewProperty(req, res);

    expect(mockParseAddress).toHaveBeenCalledWith('123 Main St, Atlanta, GA 30301', 'test-api-key');
    expect(res.json).toHaveBeenCalledWith({
      streetAddress: '123 Main St',
      county: 'fulton',
      supported: true,
      supportedCounties: MOCK_SUPPORTED_COUNTIES
    });
  });

  it('should return preview data for unsupported county', async () => {
    req.body = { address: '456 Oak Ave, Macon, GA 31201' };
    mockParseAddress.mockResolvedValue({
      streetAddress: '456 Oak Ave',
      county: 'bibb',
      isSupported: false,
      raw: {}
    });

    await propertyController.previewProperty(req, res);

    expect(res.json).toHaveBeenCalledWith({
      streetAddress: '456 Oak Ave',
      county: 'bibb',
      supported: false,
      supportedCounties: MOCK_SUPPORTED_COUNTIES
    });
  });

  it('should return 400 when parseAddress throws an error', async () => {
    req.body = { address: 'invalid address' };
    mockParseAddress.mockRejectedValue(new Error('Geocoding failed: ZERO_RESULTS'));

    await propertyController.previewProperty(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Geocoding failed: ZERO_RESULTS' });
  });

  it('should return generic error message when error has no message', async () => {
    req.body = { address: '123 Main St' };
    mockParseAddress.mockRejectedValue(new Error());

    await propertyController.previewProperty(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to validate address' });
  });
});
