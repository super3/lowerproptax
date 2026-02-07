import { jest } from '@jest/globals';

// Mock the database connection
const mockQuery = jest.fn();
jest.unstable_mockModule('../../src/db/connection.js', () => ({
  default: {
    query: mockQuery
  }
}));

// Mock the email service (must return a Promise since code calls .catch() on it)
jest.unstable_mockModule('../../src/services/emailService.js', () => ({
  sendNewPropertyNotification: jest.fn().mockResolvedValue(undefined)
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

describe('scrapePreview - cache behavior', () => {
  let req, res;
  const originalEnv = process.env;

  beforeEach(() => {
    req = { body: {} };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    mockParseAddress.mockClear();
    mockScrapeProperty.mockClear();
    mockQuery.mockClear();
    process.env = { ...originalEnv, GOOGLE_MAPS_API_KEY: 'test-api-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should write scrape results to cache on success', async () => {
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
      homesteadExemption: false,
      propertyTax2025: '4,500.00',
      parcelNumber: '12345',
      qpublicUrl: 'https://qpublic.example.com/12345',
      taxRecordUrl: 'https://taxes.example.com/12345'
    });
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    await propertyController.scrapePreview(req, res);

    // The cache insert should have been called
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('INSERT INTO scrape_cache');
    expect(params[0]).toMatch(/^cache_/); // cacheId
    expect(params[1]).toBe('123 Main St'); // address
    expect(params[2]).toBe('fulton'); // county
    expect(params[3]).toBe(3); // bedrooms
    expect(params[4]).toBe(2.5); // bathrooms
    expect(params[5]).toBe(2500); // sqft
    expect(params[6]).toBe(false); // homestead
    expect(params[7]).toBe('12345'); // parcel_number
    expect(params[8]).toBe('https://qpublic.example.com/12345'); // qpublic_url
    expect(params[9]).toBe('4,500.00'); // property_tax_2025
    expect(params[10]).toBe('https://taxes.example.com/12345'); // tax_record_url

    // Response should include cacheId
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.cacheId).toBeDefined();
    expect(responseData.cacheId).toMatch(/^cache_/);
  });

  it('should still return data even if cache write fails', async () => {
    req.body = { address: '456 Oak Ave, Marietta, GA 30064' };
    mockParseAddress.mockResolvedValue({
      streetAddress: '456 Oak Ave',
      county: 'cobb',
      isSupported: true,
      raw: {}
    });
    mockScrapeProperty.mockResolvedValue({
      bedrooms: 4,
      bathrooms: 3,
      sqft: 3000,
      homesteadExemption: true,
      propertyTax2025: '5,000.00',
      parcelNumber: 'COBB456'
    });
    // Make the cache INSERT fail
    mockQuery.mockRejectedValue(new Error('Database write error'));

    await propertyController.scrapePreview(req, res);

    // Should still return successful response with data
    expect(res.status).not.toHaveBeenCalled(); // No error status
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.address).toBe('456 Oak Ave');
    expect(responseData.county).toBe('cobb');
    expect(responseData.bedrooms).toBe(4);
    expect(responseData.cacheId).toBeDefined();
  });

  it('should handle null qpublicUrl and taxRecordUrl', async () => {
    req.body = { address: '789 Pine St, Lawrenceville, GA 30043' };
    mockParseAddress.mockResolvedValue({
      streetAddress: '789 Pine St',
      county: 'gwinnett',
      isSupported: true,
      raw: {}
    });
    mockScrapeProperty.mockResolvedValue({
      bedrooms: 3,
      bathrooms: 2,
      sqft: 1800,
      homesteadExemption: null,
      propertyTax2025: '3,200.00',
      parcelNumber: 'GW789'
      // No qpublicUrl or taxRecordUrl
    });
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    await propertyController.scrapePreview(req, res);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(params[8]).toBeNull(); // qpublic_url should be null
    expect(params[10]).toBeNull(); // tax_record_url should be null
  });
});

describe('createProperty - cache lookup with mocked pool', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      user: { id: 'user_123', email: 'test@example.com' }
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    mockQuery.mockClear();
  });

  it('should look up cache when cacheId is provided', async () => {
    const cachedRow = {
      id: 'cache_test',
      address: '123 Main St',
      county: 'fulton',
      bedrooms: 3,
      bathrooms: 2,
      sqft: 2000,
      homestead: false,
      parcel_number: 'FUL123',
      qpublic_url: 'https://qpublic.example.com/123',
      property_tax_2025: '4,000.00',
      tax_record_url: 'https://taxes.example.com/123'
    };

    // First call: cache lookup (SELECT)
    // Second call: INSERT INTO properties
    // Third call: INSERT INTO assessments
    // Fourth call: DELETE FROM scrape_cache
    mockQuery
      .mockResolvedValueOnce({ rows: [cachedRow], rowCount: 1 }) // cache lookup
      .mockResolvedValueOnce({
        rows: [{
          id: 'prop_123',
          userId: 'user_123',
          address: '123 Main St',
          city: 'Atlanta',
          state: 'GA',
          zipCode: '30301',
          country: 'US',
          lat: 33.749,
          lng: -84.388,
          bedrooms: 3,
          bathrooms: 2,
          sqft: 2000,
          homestead: false,
          parcelNumber: 'FUL123',
          qpublicUrl: 'https://qpublic.example.com/123',
          taxRecordUrl: 'https://taxes.example.com/123',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }],
        rowCount: 1
      }) // property insert
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // assessment insert
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // cache cleanup

    req.body = {
      address: '123 Main St',
      city: 'Atlanta',
      state: 'GA',
      zipCode: '30301',
      country: 'US',
      lat: 33.749,
      lng: -84.388,
      cacheId: 'cache_test'
    };

    await propertyController.createProperty(req, res);

    expect(res.status).toHaveBeenCalledWith(201);

    // Verify cache lookup was called
    expect(mockQuery.mock.calls[0][0]).toContain('FROM scrape_cache WHERE');
    expect(mockQuery.mock.calls[0][1]).toEqual(['cache_test']);

    // Verify property insert used cached data
    const insertParams = mockQuery.mock.calls[1][1];
    expect(insertParams[9]).toBe(3); // bedrooms from cache
    expect(insertParams[10]).toBe(2); // bathrooms from cache
    expect(insertParams[11]).toBe(2000); // sqft from cache

    // Verify assessment was created
    expect(mockQuery.mock.calls[2][0]).toContain('INSERT INTO assessments');

    // Verify cache was cleaned up
    expect(mockQuery.mock.calls[3][0]).toContain('DELETE FROM scrape_cache');
    expect(mockQuery.mock.calls[3][1]).toEqual(['cache_test']);
  });

  it('should handle cache lookup failure gracefully', async () => {
    mockQuery
      .mockRejectedValueOnce(new Error('Cache lookup failed')) // cache lookup fails
      .mockResolvedValueOnce({
        rows: [{
          id: 'prop_456',
          userId: 'user_123',
          address: '456 Oak Ave',
          city: 'Marietta',
          state: 'GA',
          zipCode: '30064',
          country: '',
          lat: null,
          lng: null,
          bedrooms: null,
          bathrooms: null,
          sqft: null,
          homestead: null,
          parcelNumber: null,
          qpublicUrl: null,
          taxRecordUrl: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }],
        rowCount: 1
      }) // property insert succeeds
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // cache cleanup

    req.body = {
      address: '456 Oak Ave',
      city: 'Marietta',
      state: 'GA',
      zipCode: '30064',
      cacheId: 'cache_broken'
    };

    await propertyController.createProperty(req, res);

    // Should still succeed, just without cached data
    expect(res.status).toHaveBeenCalledWith(201);
    const property = res.json.mock.calls[0][0];
    expect(property.bedrooms).toBeNull();
  });

  it('should handle assessment creation failure gracefully', async () => {
    const cachedRow = {
      id: 'cache_assess_fail',
      bedrooms: 3,
      bathrooms: 2,
      sqft: 2000,
      homestead: false,
      parcel_number: 'FUL123',
      property_tax_2025: '4,000.00'
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [cachedRow], rowCount: 1 }) // cache lookup
      .mockResolvedValueOnce({
        rows: [{
          id: 'prop_789',
          userId: 'user_123',
          address: '789 Pine St',
          city: '',
          state: '',
          zipCode: '',
          country: '',
          lat: null,
          lng: null,
          bedrooms: 3,
          bathrooms: 2,
          sqft: 2000,
          homestead: false,
          parcelNumber: 'FUL123',
          qpublicUrl: null,
          taxRecordUrl: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }],
        rowCount: 1
      }) // property insert
      .mockRejectedValueOnce(new Error('Assessment insert failed')) // assessment fails
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // cache cleanup

    req.body = {
      address: '789 Pine St',
      cacheId: 'cache_assess_fail'
    };

    await propertyController.createProperty(req, res);

    // Should still succeed, just without the assessment
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].id).toBe('prop_789');
  });

  it('should handle cache cleanup failure gracefully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // cache lookup (empty)
      .mockResolvedValueOnce({
        rows: [{
          id: 'prop_cleanup',
          userId: 'user_123',
          address: '111 Elm St',
          city: '',
          state: '',
          zipCode: '',
          country: '',
          lat: null,
          lng: null,
          bedrooms: null,
          bathrooms: null,
          sqft: null,
          homestead: null,
          parcelNumber: null,
          qpublicUrl: null,
          taxRecordUrl: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }],
        rowCount: 1
      }) // property insert
      .mockRejectedValueOnce(new Error('Cleanup failed')); // cache cleanup fails

    req.body = {
      address: '111 Elm St',
      cacheId: 'cache_cleanup_broken'
    };

    await propertyController.createProperty(req, res);

    // Should still succeed
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('should not attempt cache lookup when cacheId is not provided', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'prop_nocache',
        userId: 'user_123',
        address: '999 No Cache St',
        city: '',
        state: '',
        zipCode: '',
        country: '',
        lat: null,
        lng: null,
        bedrooms: null,
        bathrooms: null,
        sqft: null,
        homestead: null,
        parcelNumber: null,
        qpublicUrl: null,
        taxRecordUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }],
      rowCount: 1
    });

    req.body = { address: '999 No Cache St' };

    await propertyController.createProperty(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    // Only one query call (the INSERT), no cache lookup or cleanup
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toContain('INSERT INTO properties');
  });
});
