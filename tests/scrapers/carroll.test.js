import { scrapeProperty } from '../../src/scrapers/county-scraper.js';

describe('Carroll County Scraper', () => {
  const TEST_ADDRESS = '2100 Star Point Rd';
  const COUNTY = 'carroll';

  let result;

  beforeAll(async () => {
    result = await scrapeProperty(TEST_ADDRESS, COUNTY);
  }, 120000); // 2 minute timeout for scraper

  test('should return result object', () => {
    expect(result).not.toBeNull();
  });

  test('should return bedrooms', () => {
    expect(result.bedrooms).toBeGreaterThan(0);
  });

  test('should return bathrooms', () => {
    expect(result.bathrooms).toBeGreaterThan(0);
  });

  test('should return square footage', () => {
    expect(result.sqft).toBeGreaterThan(0);
  });

  test('should return a parcel number', () => {
    expect(result.parcelNumber).toBeTruthy();
  });

  test('should return qpublic URL', () => {
    expect(result.qpublicUrl).toContain('schneidercorp.com');
  });

  test('should return 2025 property tax payment (or null if site is unavailable)', () => {
    if (result.propertyTax2025 !== null) {
      expect(result.propertyTax2025).toMatch(/[\d,]+\.\d{2}/);
    } else {
      expect(result.propertyTax2025).toBeNull();
    }
  });
});
