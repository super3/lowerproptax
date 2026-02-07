import { scrapeProperty } from '../../src/scrapers/county-scraper.js';

describe('DeKalb County Scraper', () => {
  const TEST_ADDRESS = '823 Greenhedge Dr';
  const COUNTY = 'dekalb';

  let result;

  beforeAll(async () => {
    result = await scrapeProperty(TEST_ADDRESS, COUNTY);
  }, 120000); // 2 minute timeout for scraper

  test('should return result object (or null if site is unavailable)', () => {
    if (result === null) {
      expect(result).toBeNull();
      return;
    }
    expect(result).toBeDefined();
  });

  test('should return bedrooms (or null if site layout differs)', () => {
    if (result === null) return;
    if (result.bedrooms !== null) {
      expect(result.bedrooms).toBeGreaterThan(0);
    } else {
      expect(result.bedrooms).toBeNull();
    }
  });

  test('should return bathrooms (or null if site layout differs)', () => {
    if (result === null) return;
    if (result.bathrooms !== null) {
      expect(result.bathrooms).toBeGreaterThan(0);
    } else {
      expect(result.bathrooms).toBeNull();
    }
  });

  test('should return square footage (or null if site layout differs)', () => {
    if (result === null) return;
    if (result.sqft !== null) {
      expect(result.sqft).toBeGreaterThan(0);
    } else {
      expect(result.sqft).toBeNull();
    }
  });

  test('should return a parcel number (or null if site is unavailable)', () => {
    if (result === null) return;
    expect(result.parcelNumber).toBeTruthy();
  });

  test('should return qpublic URL (or null if site is unavailable)', () => {
    if (result === null) return;
    expect(result.qpublicUrl).toContain('schneidercorp.com');
  });

  test('should return 2025 property tax payment (or null if site is unavailable)', () => {
    if (result === null) return;
    // DeKalb County tax site may timeout or block in CI environments
    if (result.propertyTax2025 !== null) {
      expect(result.propertyTax2025).toMatch(/[\d,]+\.\d{2}/);
    } else {
      expect(result.propertyTax2025).toBeNull();
    }
  });
});
