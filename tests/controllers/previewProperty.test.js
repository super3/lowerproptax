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
jest.unstable_mockModule('../../src/scrapers/address-parser.js', () => ({
  parseAddress: mockParseAddress,
  SUPPORTED_COUNTIES: MOCK_SUPPORTED_COUNTIES
}));

// Mock the county scraper
const mockScrapeProperty = jest.fn();
jest.unstable_mockModule('../../src/scrapers/county-scraper.js', () => ({
  scrapeProperty: mockScrapeProperty
}));

// Import the controller after mocking
const propertyController = await import('../../src/controllers/propertyController.js');

describe('scrapePreview', () => {
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
    mockScrapeProperty.mockClear();
    process.env = { ...originalEnv, GOOGLE_MAPS_API_KEY: 'test-api-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return 400 if address is missing', async () => {
    req.body = {};

    await propertyController.scrapePreview(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Address is required' });
  });

  it('should return 500 if Google Maps API key is not configured', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    req.body = { address: '123 Main St, Atlanta, GA' };

    await propertyController.scrapePreview(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Google Maps API key not configured' });
  });

  it('should return 400 for unsupported county', async () => {
    req.body = { address: '456 Oak Ave, Macon, GA 31201' };
    mockParseAddress.mockResolvedValue({
      streetAddress: '456 Oak Ave',
      county: 'bibb',
      isSupported: false,
      raw: {}
    });

    await propertyController.scrapePreview(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'County not supported: bibb' });
  });

  it('should return 404 if scraper returns no data', async () => {
    req.body = { address: '123 Main St, Atlanta, GA 30301' };
    mockParseAddress.mockResolvedValue({
      streetAddress: '123 Main St',
      county: 'fulton',
      isSupported: true,
      raw: {}
    });
    mockScrapeProperty.mockResolvedValue(null);

    await propertyController.scrapePreview(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Could not find property data' });
  });

  it('should return scraped property data for supported county', async () => {
    req.body = { address: '123 Main St, Atlanta, GA 30301' };
    mockParseAddress.mockResolvedValue({
      streetAddress: '123 Main St',
      county: 'fulton',
      isSupported: true,
      raw: {}
    });
    mockScrapeProperty.mockResolvedValue({
      bedrooms: 3,
      bathrooms: 2.5,
      sqft: 2500,
      homesteadExemption: true,
      propertyTax2025: '4,500.00',
      parcelNumber: '12345'
    });

    await propertyController.scrapePreview(req, res);

    expect(mockScrapeProperty).toHaveBeenCalledWith('123 Main St', 'fulton');
    expect(res.json).toHaveBeenCalledWith({
      address: '123 Main St',
      county: 'fulton',
      bedrooms: 3,
      bathrooms: 2.5,
      sqft: 2500,
      homesteadExemption: true,
      propertyTax2025: '4,500.00',
      parcelNumber: '12345'
    });
  });

  it('should return 500 when scraper throws an error', async () => {
    req.body = { address: '123 Main St, Atlanta, GA 30301' };
    mockParseAddress.mockResolvedValue({
      streetAddress: '123 Main St',
      county: 'fulton',
      isSupported: true,
      raw: {}
    });
    mockScrapeProperty.mockRejectedValue(new Error('Scraper timeout'));

    await propertyController.scrapePreview(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Scraper timeout' });
  });
});
