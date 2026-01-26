import { scrapeProperty } from '../../scripts/county-scraper.js';

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

  test('should return valid assessment PDF URL', () => {
    expect(result.assessment2025Pdf).toBeTruthy();
    expect(result.assessment2025Pdf).toMatch(/^https:\/\//);
    expect(result.assessment2025Pdf).not.toContain(' '); // No unencoded spaces
  });
});
