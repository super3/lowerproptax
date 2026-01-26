import { scrapeProperty } from '../../scripts/county-scraper.js';

describe('Cobb County Scraper', () => {
  const TEST_ADDRESS = '443 VININGS VINTAGE CIR';
  const COUNTY = 'cobb';

  let result;

  beforeAll(async () => {
    result = await scrapeProperty(TEST_ADDRESS, COUNTY);
  }, 120000); // 2 minute timeout for scraper

  test('should return result object', () => {
    expect(result).not.toBeNull();
  });

  test('should return correct bedrooms', () => {
    expect(result.bedrooms).toBe(4);
  });

  test('should return correct bathrooms', () => {
    expect(result.bathrooms).toBe(2.5);
  });

  test('should return correct square footage', () => {
    expect(result.sqft).toBe(2254);
  });

  test('should return homestead exemption status if available', () => {
    // Homestead exemption may not be available for all counties
    if (result.homesteadExemption !== null) {
      expect(typeof result.homesteadExemption).toBe('boolean');
    }
  });

  test('should return valid assessment PDF URL', () => {
    expect(result.assessment2025Pdf).toBeTruthy();
    expect(result.assessment2025Pdf).toMatch(/^https:\/\//);
    expect(result.assessment2025Pdf).not.toContain(' ');
  });
});
