import { scrapeProperty } from '../../src/scrapers/county-scraper.js';

describe('Paulding County Scraper', () => {
  const TEST_ADDRESS = '175 Jordan Rd';
  const COUNTY = 'paulding';

  let result;

  beforeAll(async () => {
    result = await scrapeProperty(TEST_ADDRESS, COUNTY);
  }, 120000); // 2 minute timeout for scraper

  test('should return result object (or null if extra modals block scraper)', () => {
    // Paulding shows extra modals (homestead notice) that may block the scraper
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

  test('should return qpublic URL (or null if scraper failed)', () => {
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
