import { scrapeProperty } from '../../scripts/fulton-scraper.js';

describe('Fulton County Scraper', () => {
  const TEST_ADDRESS = '6607 ARIA BLVD';

  let result;

  beforeAll(async () => {
    result = await scrapeProperty(TEST_ADDRESS);
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
    expect(result.assessmentPdf).toBeTruthy();
    expect(result.assessmentPdf).toMatch(/^https:\/\//);
    expect(result.assessmentPdf).not.toContain(' '); // No unencoded spaces
  });
});
