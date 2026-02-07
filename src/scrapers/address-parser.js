/**
 * Address Parser - Uses Google Maps Geocoding API to:
 * 1. Detect which county an address is in
 * 2. Extract a clean street address for county scraper searches
 */

const SUPPORTED_COUNTIES = [
  'fulton', 'gwinnett', 'cobb', 'dekalb', 'clayton',
  'paulding', 'newton', 'dougherty', 'muscogee', 'carroll', 'hall'
];

/**
 * Parse a full address using Google Maps Geocoding API
 * @param {string} fullAddress - Full address like "2517 Weycroft Cir NE, Dacula, GA 30019, USA"
 * @param {string} apiKey - Google Maps API key
 * @returns {Promise<{streetAddress: string, county: string|null, isSupported: boolean, raw: object}>}
 */
async function parseAddress(fullAddress, apiKey) {
  if (!apiKey) {
    throw new Error('Google Maps API key is required');
  }

  const encodedAddress = encodeURIComponent(fullAddress);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== 'OK' || !data.results || data.results.length === 0) {
    throw new Error(`Geocoding failed: ${data.status} - ${data.error_message || 'No results found'}`);
  }

  const result = data.results[0];
  const components = result.address_components;

  // Extract street number and route (street name)
  // Use short_name for route to get abbreviated form (e.g., "Weycroft Cir NE" vs "Weycroft Circle Northeast")
  const streetNumber = components.find(c => c.types.includes('street_number'))?.long_name || '';
  const route = components.find(c => c.types.includes('route'))?.short_name || '';

  // Extract county (administrative_area_level_2)
  const countyComponent = components.find(c => c.types.includes('administrative_area_level_2'));
  let county = null;

  if (countyComponent) {
    // County comes as "Gwinnett County" - extract just the name
    const countyName = countyComponent.long_name.replace(/\s*County$/i, '').toLowerCase();
    county = countyName;
  }

  // Build clean street address (just number + street name, no cardinal direction)
  // The route from Google already excludes cardinal directions in most cases
  let streetAddress = `${streetNumber} ${route}`.trim();

  // Remove trailing cardinal directions if present (N, S, E, W, NE, NW, SE, SW)
  streetAddress = streetAddress.replace(/\s+(N|S|E|W|NE|NW|SE|SW)$/i, '');

  return {
    streetAddress,
    county,
    isSupported: county ? SUPPORTED_COUNTIES.includes(county) : false,
    raw: result
  };
}

/**
 * Parse address and return data ready for scraping
 * @param {string} fullAddress - Full address
 * @param {string} apiKey - Google Maps API key
 * @returns {Promise<{streetAddress: string, county: string}>}
 * @throws {Error} if address is not in a supported county
 */
async function parseAddressForScraping(fullAddress, apiKey) {
  const parsed = await parseAddress(fullAddress, apiKey);

  if (!parsed.isSupported) {
    const supported = SUPPORTED_COUNTIES.join(', ');
    throw new Error(
      `Address is in ${parsed.county || 'unknown'} county. ` +
      `Only these Georgia counties are supported: ${supported}`
    );
  }

  return {
    streetAddress: parsed.streetAddress,
    county: parsed.county
  };
}

export { parseAddress, parseAddressForScraping, SUPPORTED_COUNTIES };
