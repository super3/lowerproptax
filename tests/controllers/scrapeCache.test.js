import { jest } from '@jest/globals';
import {
  createMockRequest,
  createMockResponse,
  mockUser
} from '../utils/mockClerk.js';
import {
  addMockScrapeCache,
  clearMockScrapeCache,
  getMockScrapeCache,
  clearMockAssessments
} from '../utils/mockDatabase.js';

// Import the controller
const propertyController = await import('../../src/controllers/propertyController.js');

describe('Scrape Cache - createProperty with cacheId', () => {
  let req, res;

  beforeEach(async () => {
    await propertyController.resetProperties();
    await propertyController.resetScrapeCache();
    clearMockAssessments();
    clearMockScrapeCache();

    req = createMockRequest({
      user: { id: mockUser.id, email: 'test@example.com' }
    });
    res = createMockResponse();
  });

  test('should create property without cacheId (backward compatible)', async () => {
    req.body = {
      address: '123 Main St',
      city: 'Atlanta',
      state: 'GA',
      zipCode: '30301'
    };

    await propertyController.createProperty(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const property = res.json.mock.calls[0][0];
    expect(property.address).toBe('123 Main St');
    expect(property.bedrooms).toBeNull();
    expect(property.bathrooms).toBeNull();
    expect(property.sqft).toBeNull();
    expect(property.homestead).toBeNull();
    expect(property.parcelNumber).toBeNull();
  });

  test('should hydrate property from cache when valid cacheId provided', async () => {
    const cacheId = 'cache_test_123';
    addMockScrapeCache(cacheId, {
      address: '123 Main St',
      county: 'fulton',
      bedrooms: 3,
      bathrooms: 2.5,
      sqft: 2500,
      homestead: false,
      parcel_number: '12 345 678',
      qpublic_url: 'https://qpublic.example.com/property/123',
      property_tax_2025: '4,500.00',
      tax_record_url: 'https://taxes.example.com/record/123'
    });

    req.body = {
      address: '123 Main St, Atlanta, GA 30301',
      city: 'Atlanta',
      state: 'GA',
      zipCode: '30301',
      country: 'US',
      lat: 33.749,
      lng: -84.388,
      cacheId
    };

    await propertyController.createProperty(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const property = res.json.mock.calls[0][0];
    expect(property.bedrooms).toBe(3);
    expect(property.bathrooms).toBe(2.5);
    expect(property.sqft).toBe(2500);
    expect(property.homestead).toBe(false);
    expect(property.parcelNumber).toBe('12 345 678');
    expect(property.qpublicUrl).toBe('https://qpublic.example.com/property/123');
    expect(property.taxRecordUrl).toBe('https://taxes.example.com/record/123');
  });

  test('should auto-create assessment when cache has tax data and no homestead', async () => {
    const cacheId = 'cache_test_assessment';
    addMockScrapeCache(cacheId, {
      address: '456 Oak Ave',
      county: 'cobb',
      bedrooms: 4,
      bathrooms: 3,
      sqft: 3000,
      homestead: false,
      parcel_number: 'COBB123',
      property_tax_2025: '5,000.00',
      tax_record_url: 'https://taxes.example.com/cobb/123'
    });

    req.body = {
      address: '456 Oak Ave, Marietta, GA 30064',
      city: 'Marietta',
      state: 'GA',
      zipCode: '30064',
      cacheId
    };

    await propertyController.createProperty(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const property = res.json.mock.calls[0][0];

    // Verify property was created with cache data
    expect(property.bedrooms).toBe(4);

    // Now check that the property has an assessment by fetching properties
    res.json.mockClear();
    res.status.mockClear();
    await propertyController.getProperties(req, res);

    const properties = res.json.mock.calls[0][0];
    expect(properties).toHaveLength(1);
    expect(properties[0].latestAssessment).not.toBeNull();
    expect(properties[0].latestAssessment.annualTax).toBe(5000);
    // With homestead === false, estimated tax should be taxValue * 0.675
    expect(properties[0].latestAssessment.estimatedAnnualTax).toBe(5000 * 0.675);
    expect(properties[0].latestAssessment.status).toBe('preparing');
  });

  test('should create assessment with same tax when homestead is true', async () => {
    const cacheId = 'cache_homestead_true';
    addMockScrapeCache(cacheId, {
      address: '789 Pine St',
      county: 'gwinnett',
      bedrooms: 3,
      bathrooms: 2,
      sqft: 1800,
      homestead: true,
      parcel_number: 'GW789',
      property_tax_2025: '3,200.00'
    });

    req.body = {
      address: '789 Pine St, Lawrenceville, GA 30043',
      city: 'Lawrenceville',
      state: 'GA',
      zipCode: '30043',
      cacheId
    };

    await propertyController.createProperty(req, res);

    expect(res.status).toHaveBeenCalledWith(201);

    // Get properties to check assessment
    res.json.mockClear();
    await propertyController.getProperties(req, res);

    const properties = res.json.mock.calls[0][0];
    expect(properties[0].latestAssessment).not.toBeNull();
    expect(properties[0].latestAssessment.annualTax).toBe(3200);
    // With homestead === true, estimated tax should equal actual tax
    expect(properties[0].latestAssessment.estimatedAnnualTax).toBe(3200);
  });

  test('should not create assessment when cache has no tax data', async () => {
    const cacheId = 'cache_no_tax';
    addMockScrapeCache(cacheId, {
      address: '111 Elm St',
      county: 'fulton',
      bedrooms: 2,
      bathrooms: 1,
      sqft: 1200,
      homestead: null,
      parcel_number: 'FUL111'
      // No property_tax_2025
    });

    req.body = {
      address: '111 Elm St, Atlanta, GA 30301',
      city: 'Atlanta',
      state: 'GA',
      zipCode: '30301',
      cacheId
    };

    await propertyController.createProperty(req, res);

    expect(res.status).toHaveBeenCalledWith(201);

    // Get properties to check no assessment was created
    res.json.mockClear();
    await propertyController.getProperties(req, res);

    const properties = res.json.mock.calls[0][0];
    expect(properties[0].latestAssessment).toBeNull();
  });

  test('should clean up cache entry after use', async () => {
    const cacheId = 'cache_cleanup_test';
    addMockScrapeCache(cacheId, {
      address: '222 Maple Dr',
      county: 'cobb',
      bedrooms: 3,
      bathrooms: 2,
      sqft: 2000,
      homestead: false,
      parcel_number: 'COBB222',
      property_tax_2025: '4,000.00'
    });

    // Verify cache entry exists before
    expect(getMockScrapeCache().has(cacheId)).toBe(true);

    req.body = {
      address: '222 Maple Dr, Kennesaw, GA 30144',
      city: 'Kennesaw',
      state: 'GA',
      zipCode: '30144',
      cacheId
    };

    await propertyController.createProperty(req, res);

    // Verify cache entry was cleaned up
    expect(getMockScrapeCache().has(cacheId)).toBe(false);
  });

  test('should handle invalid/nonexistent cacheId gracefully', async () => {
    req.body = {
      address: '333 Birch Ln',
      city: 'Roswell',
      state: 'GA',
      zipCode: '30075',
      cacheId: 'cache_nonexistent'
    };

    await propertyController.createProperty(req, res);

    // Should still create the property, just without cached data
    expect(res.status).toHaveBeenCalledWith(201);
    const property = res.json.mock.calls[0][0];
    expect(property.address).toBe('333 Birch Ln');
    expect(property.bedrooms).toBeNull();
    expect(property.sqft).toBeNull();
  });

  test('should handle expired cache entry', async () => {
    const cacheId = 'cache_expired';
    addMockScrapeCache(cacheId, {
      address: '444 Cedar Ct',
      county: 'fulton',
      bedrooms: 5,
      bathrooms: 4,
      sqft: 4000,
      homestead: false,
      parcel_number: 'FUL444',
      property_tax_2025: '8,000.00',
      // Set expires_at to the past
      expires_at: new Date(Date.now() - 1000).toISOString()
    });

    req.body = {
      address: '444 Cedar Ct, Atlanta, GA 30301',
      city: 'Atlanta',
      state: 'GA',
      zipCode: '30301',
      cacheId
    };

    await propertyController.createProperty(req, res);

    // Should still create the property, but without cached data
    expect(res.status).toHaveBeenCalledWith(201);
    const property = res.json.mock.calls[0][0];
    expect(property.bedrooms).toBeNull();
    expect(property.sqft).toBeNull();
  });

  test('should handle cacheId as null', async () => {
    req.body = {
      address: '555 Walnut Way',
      city: 'Duluth',
      state: 'GA',
      zipCode: '30096',
      cacheId: null
    };

    await propertyController.createProperty(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const property = res.json.mock.calls[0][0];
    expect(property.address).toBe('555 Walnut Way');
    expect(property.bedrooms).toBeNull();
  });

  test('should handle tax amount with commas correctly', async () => {
    const cacheId = 'cache_commas';
    addMockScrapeCache(cacheId, {
      address: '666 Spruce Blvd',
      county: 'fulton',
      bedrooms: 6,
      bathrooms: 5,
      sqft: 6000,
      homestead: false,
      parcel_number: 'FUL666',
      property_tax_2025: '15,262.32'
    });

    req.body = {
      address: '666 Spruce Blvd, Atlanta, GA 30301',
      city: 'Atlanta',
      state: 'GA',
      zipCode: '30301',
      cacheId
    };

    await propertyController.createProperty(req, res);

    // Get properties to check assessment parsing
    res.json.mockClear();
    await propertyController.getProperties(req, res);

    const properties = res.json.mock.calls[0][0];
    expect(properties[0].latestAssessment).not.toBeNull();
    expect(properties[0].latestAssessment.annualTax).toBe(15262.32);
    expect(properties[0].latestAssessment.estimatedAnnualTax).toBeCloseTo(15262.32 * 0.675, 2);
  });

  test('should handle homestead null with tax data (estimated = actual)', async () => {
    const cacheId = 'cache_null_homestead';
    addMockScrapeCache(cacheId, {
      address: '777 Ash St',
      county: 'gwinnett',
      bedrooms: 3,
      bathrooms: 2,
      sqft: 2200,
      homestead: null,
      parcel_number: 'GW777',
      property_tax_2025: '3,500.00'
    });

    req.body = {
      address: '777 Ash St, Norcross, GA 30093',
      city: 'Norcross',
      state: 'GA',
      zipCode: '30093',
      cacheId
    };

    await propertyController.createProperty(req, res);

    // Get properties to check assessment
    res.json.mockClear();
    await propertyController.getProperties(req, res);

    const properties = res.json.mock.calls[0][0];
    expect(properties[0].latestAssessment).not.toBeNull();
    // With homestead === null (not false), estimated should equal actual
    expect(properties[0].latestAssessment.annualTax).toBe(3500);
    expect(properties[0].latestAssessment.estimatedAnnualTax).toBe(3500);
  });
});

describe('Scrape Cache - resetScrapeCache', () => {
  test('should clear all scrape cache entries', async () => {
    addMockScrapeCache('cache_1', { address: 'addr1', county: 'fulton' });
    addMockScrapeCache('cache_2', { address: 'addr2', county: 'cobb' });
    expect(getMockScrapeCache().size).toBe(2);

    await propertyController.resetScrapeCache();

    expect(getMockScrapeCache().size).toBe(0);
  });
});
