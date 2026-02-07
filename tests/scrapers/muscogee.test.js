import { scrapeProperty } from '../../src/scrapers/county-scraper.js';

describe('Muscogee County Scraper', () => {
  const TEST_ADDRESS = '8150 Preservation Trl';
  const COUNTY = 'muscogee';

  let result;

  beforeAll(async () => {
    result = await scrapeProperty(TEST_ADDRESS, COUNTY);
  }, 120000); // 2 minute timeout for scraper

  test('should return result object', () => {
    expect(result).not.toBeNull();
  });

  test('should return bedrooms (or null if site layout differs)', () => {
    if (result.bedrooms !== null) {
      expect(result.bedrooms).toBeGreaterThan(0);
    } else {
      expect(result.bedrooms).toBeNull();
    }
  });

  test('should return bathrooms (or null if site layout differs)', () => {
    if (result.bathrooms !== null) {
      expect(result.bathrooms).toBeGreaterThan(0);
    } else {
      expect(result.bathrooms).toBeNull();
    }
  });

  test('should return square footage (or null if site layout differs)', () => {
    if (result.sqft !== null) {
      expect(result.sqft).toBeGreaterThan(0);
    } else {
      expect(result.sqft).toBeNull();
    }
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
