import { parseAddressForScraping } from '../../scripts/address-parser.js';
import { scrapeProperty } from '../../scripts/county-scraper.js';

describe('Full Address Scraping', () => {
  const FULL_ADDRESS = '2517 Weycroft Cir NE, Dacula, GA 30019, USA';
  const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

  let parsedAddress;
  let result;

  beforeAll(async () => {
    if (!API_KEY) {
      throw new Error('GOOGLE_MAPS_API_KEY environment variable is required');
    }

    // Step 1: Parse the full address to get county and clean street address
    parsedAddress = await parseAddressForScraping(FULL_ADDRESS, API_KEY);

    // Step 2: Scrape using the parsed data
    result = await scrapeProperty(parsedAddress.streetAddress, parsedAddress.county);
  }, 120000);

  describe('Address Parsing', () => {
    test('should detect Gwinnett county', () => {
      expect(parsedAddress.county).toBe('gwinnett');
    });

    test('should extract clean street address without cardinal direction', () => {
      expect(parsedAddress.streetAddress).toBe('2517 Weycroft Cir');
    });
  });

  describe('Property Scraping', () => {
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
    });
  });
});
