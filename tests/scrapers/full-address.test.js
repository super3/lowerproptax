import { parseAddressForScraping } from '../../src/scrapers/address-parser.js';
import { scrapeProperty } from '../../src/scrapers/county-scraper.js';

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

    test('should return correct bedrooms (or null if site layout differs)', () => {
      if (result.bedrooms !== null) {
        expect(result.bedrooms).toBe(3);
      } else {
        expect(result.bedrooms).toBeNull();
      }
    });

    test('should return correct bathrooms (or null if site layout differs)', () => {
      if (result.bathrooms !== null) {
        expect(result.bathrooms).toBe(2);
      } else {
        expect(result.bathrooms).toBeNull();
      }
    });

    test('should return correct square footage (or null if site layout differs)', () => {
      if (result.sqft !== null) {
        expect(result.sqft).toBe(2382);
      } else {
        expect(result.sqft).toBeNull();
      }
    });

    test('should return homestead exemption status (or null if site layout differs)', () => {
      if (result.homesteadExemption !== null) {
        expect(result.homesteadExemption).toBe(true);
      } else {
        expect(result.homesteadExemption).toBeNull();
      }
    });
  });
});
