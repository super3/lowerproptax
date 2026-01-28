import { scrapeProperty } from '../../scripts/county-scraper.js';

describe('Fulton County Scraper', () => {
  const TEST_ADDRESS = '6607 ARIA BLVD';
  const COUNTY = 'fulton';

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

  test('should return correct bathrooms (including half baths)', () => {
    expect(result.bathrooms).toBe(3.5);
  });

  test('should return correct square footage', () => {
    expect(result.sqft).toBe(4118);
  });

  test('should return valid assessment PDF URL', () => {
    expect(result.assessment2025Pdf).toBeTruthy();
    expect(result.assessment2025Pdf).toMatch(/^https:\/\//);
    expect(result.assessment2025Pdf).not.toContain(' '); // No unencoded spaces
  });

  test('should return correct parcel number', () => {
    // Note: parcel has two spaces between 0034 and LL3967
    expect(result.parcelNumber).toBe('17 0034  LL3967');
  });

  test('should return 2025 property tax payment', () => {
    expect(result.propertyTax2025).toBe('15,262.32');
  });
});
