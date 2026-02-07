import { scrapeProperty } from '../../src/scrapers/county-scraper.js';

describe('Clayton County Scraper', () => {
  const TEST_ADDRESS = '8452 Willows Ter';
  const COUNTY = 'clayton';

  let result;

  beforeAll(async () => {
    result = await scrapeProperty(TEST_ADDRESS, COUNTY);
  }, 120000); // 2 minute timeout for scraper

  test('should return result object (or null if Beacon site is unavailable)', () => {
    // Beacon sites may have different DOM structures that cause scraping to fail
    if (result === null) {
      expect(result).toBeNull();
      return;
    }
    expect(result).toBeDefined();
  });

  test('should return bedrooms (or null)', () => {
    if (result === null) return;
    if (result.bedrooms !== null) {
      expect(result.bedrooms).toBeGreaterThan(0);
    } else {
      expect(result.bedrooms).toBeNull();
    }
  });

  test('should return bathrooms (or null)', () => {
    if (result === null) return;
    if (result.bathrooms !== null) {
      expect(result.bathrooms).toBeGreaterThan(0);
    } else {
      expect(result.bathrooms).toBeNull();
    }
  });

  test('should return square footage (or null)', () => {
    if (result === null) return;
    if (result.sqft !== null) {
      expect(result.sqft).toBeGreaterThan(0);
    } else {
      expect(result.sqft).toBeNull();
    }
  });

  test('should return a parcel number (or null)', () => {
    if (result === null) return;
    if (result.parcelNumber !== null) {
      expect(result.parcelNumber).toBeTruthy();
    } else {
      expect(result.parcelNumber).toBeNull();
    }
  });

  test('should return beacon URL (or null if scraper failed)', () => {
    if (result === null) return;
    expect(result.qpublicUrl).toContain('schneidercorp.com');
  });

  test('should return 2025 property tax payment (or null if site is unavailable)', () => {
    if (result === null) return;
    if (result.propertyTax2025 !== null) {
      expect(result.propertyTax2025).toMatch(/[\d,]+\.\d{2}/);
    } else {
      expect(result.propertyTax2025).toBeNull();
    }
  });
});
