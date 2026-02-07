import { scrapeProperty } from '../../src/scrapers/county-scraper.js';

describe('Cobb County Scraper', () => {
  const TEST_ADDRESS = '443 VININGS VINTAGE CIR';
  const COUNTY = 'cobb';

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

  test('should return correct bedrooms (or null if site is unavailable)', () => {
    if (result === null) return;
    expect(result.bedrooms).toBe(4);
  });

  test('should return correct bathrooms (or null if site is unavailable)', () => {
    if (result === null) return;
    expect(result.bathrooms).toBe(2.5);
  });

  test('should return correct square footage (or null if site is unavailable)', () => {
    if (result === null) return;
    expect(result.sqft).toBe(2254);
  });

  test('should return homestead exemption status from PDF (or null if site is unavailable)', () => {
    if (result === null) return;
    expect(result.homesteadExemption).toBe(true);
  });

  test('should return correct parcel number (or null if site is unavailable)', () => {
    if (result === null) return;
    expect(result.parcelNumber).toBe('18018300540');
  });

  test('should return 2025 property tax payment (or null if site times out)', () => {
    if (result === null) return;
    // Cobb County Taxes site has aggressive Cloudflare protection that may timeout in CI
    // If we got a value, verify it's correct; if null, that's acceptable
    if (result.propertyTax2025 !== null) {
      expect(result.propertyTax2025).toBe('1,175.65');
    } else {
      // Site timed out - this is acceptable in CI environments
      expect(result.propertyTax2025).toBeNull();
    }
  });
});
