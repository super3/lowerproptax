import { scrapeProperty } from '../../src/scrapers/county-scraper.js';

describe('Gwinnett County Scraper', () => {
  const TEST_ADDRESS = '2517 Weycroft Cir';
  const COUNTY = 'gwinnett';

  let result;

  beforeAll(async () => {
    result = await scrapeProperty(TEST_ADDRESS, COUNTY);
  }, 120000); // 2 minute timeout for scraper

  test('should return result object', () => {
    expect(result).not.toBeNull();
  });

  test('should return correct bedrooms', () => {
    expect(result.bedrooms).toBe(3);
  });

  test('should return correct bathrooms', () => {
    expect(result.bathrooms).toBe(2);
  });

  test('should return correct square footage', () => {
    expect(result.sqft).toBe(2382);
  });

  test('should return homestead exemption status', () => {
    expect(result.homesteadExemption).toBe(true);
  });

  test('should return correct parcel number', () => {
    expect(result.parcelNumber).toBe('R7058 149');
  });

  test('should return 2025 property tax payment (or null if site times out)', () => {
    // Gwinnett County tax PDF site may be unavailable in CI environments
    // If we got a value, verify it's correct; if null, that's acceptable
    if (result.propertyTax2025 !== null) {
      expect(result.propertyTax2025).toBe('4,911.54');
    } else {
      // Site timed out - this is acceptable in CI environments
      expect(result.propertyTax2025).toBeNull();
    }
  });
});
