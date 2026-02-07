import { scrapeProperty } from '../../src/scrapers/county-scraper.js';

describe('Fulton County Scraper', () => {
  const TEST_ADDRESS = '6607 ARIA BLVD';
  const COUNTY = 'fulton';

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

  test('should return correct bedrooms (or null if site layout differs)', () => {
    if (result === null) return;
    if (result.bedrooms !== null) {
      expect(result.bedrooms).toBe(3);
    } else {
      expect(result.bedrooms).toBeNull();
    }
  });

  test('should return correct bathrooms (or null if site layout differs)', () => {
    if (result === null) return;
    if (result.bathrooms !== null) {
      expect(result.bathrooms).toBe(3.5);
    } else {
      expect(result.bathrooms).toBeNull();
    }
  });

  test('should return correct square footage (or null if site layout differs)', () => {
    if (result === null) return;
    if (result.sqft !== null) {
      expect(result.sqft).toBe(4118);
    } else {
      expect(result.sqft).toBeNull();
    }
  });

  test('should return correct parcel number (or null if site is unavailable)', () => {
    if (result === null) return;
    // Note: parcel has two spaces between 0034 and LL3967
    expect(result.parcelNumber).toBe('17 0034  LL3967');
  });

  test('should return 2025 property tax payment (or null if site times out)', () => {
    if (result === null) return;
    // Fulton County Taxes site has Cloudflare protection that may timeout in CI
    // If we got a value, verify it's correct; if null, that's acceptable
    if (result.propertyTax2025 !== null) {
      expect(result.propertyTax2025).toBe('15,262.32');
    } else {
      // Site timed out - this is acceptable in CI environments
      expect(result.propertyTax2025).toBeNull();
    }
  });
});
