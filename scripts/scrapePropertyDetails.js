/**
 * Scrape property details (bedrooms, bathrooms, etc.) from qPublic Fulton County
 *
 * Usage:
 *   Test mode (no DB write): node scripts/scrapePropertyDetails.js --test
 *   Full run: node scripts/scrapePropertyDetails.js
 */

import 'dotenv/config';
import { chromium } from 'playwright';
import pg from 'pg';

const { Pool } = pg;

const TEST_MODE = process.argv.includes('--test');
const TEST_LIMIT = 20;
const DELAY_MS = 2000; // Delay between requests

/**
 * Build qPublic URL for a Fulton County parcel
 */
function buildUrl(parcelId) {
  const keyValue = encodeURIComponent(parcelId);
  return `https://qpublic.schneidercorp.com/Application.aspx?AppID=936&LayerID=18251&PageTypeID=4&PageID=8156&KeyValue=${keyValue}`;
}

/**
 * Convert "4/1" bathroom format to decimal (4.5)
 */
function parseBathrooms(bathroomStr) {
  if (!bathroomStr) return null;
  const match = bathroomStr.match(/(\d+)\s*\/\s*(\d+)/);
  if (match) {
    const full = parseInt(match[1]) || 0;
    const half = parseInt(match[2]) || 0;
    return full + (half * 0.5);
  }
  // Try parsing as plain number
  const num = parseFloat(bathroomStr);
  return isNaN(num) ? null : num;
}

/**
 * Parse integer from string
 */
function parseIntOrNull(str) {
  if (!str) return null;
  const num = parseInt(str.replace(/,/g, ''));
  return isNaN(num) ? null : num;
}

/**
 * Parse property details from the page
 */
async function parsePropertyDetails(page) {
  return await page.evaluate(() => {
    const details = {};

    // Helper to get text content by label
    const getField = (label) => {
      const strongs = document.querySelectorAll('th strong');
      for (const strong of strongs) {
        if (strong.textContent.trim().toLowerCase().includes(label.toLowerCase())) {
          const th = strong.closest('th');
          const td = th?.nextElementSibling;
          if (td) {
            return td.textContent.trim() || null;
          }
        }
      }
      return null;
    };

    details.bedrooms = getField('Bedrooms');
    details.bathrooms = getField('Full Bath/Half Bath');
    details.year_built = getField('Year Built');
    details.stories = getField('Stories');
    details.style = getField('Style');
    details.square_ft = getField('Res Sq Ft');

    return details;
  });
}

/**
 * Scrape a single property
 */
async function scrapeProperty(page, parcelId) {
  const url = buildUrl(parcelId);

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Handle Terms and Conditions popup if present
    try {
      const agreeButton = page.locator('a.btn:has-text("Agree")');
      if (await agreeButton.isVisible({ timeout: 2000 })) {
        await agreeButton.click();
        await page.waitForTimeout(1000);
      }
    } catch {
      // No popup, continue
    }

    await page.waitForTimeout(1000);

    const raw = await parsePropertyDetails(page);

    // Convert to proper types
    return {
      bedrooms: parseIntOrNull(raw.bedrooms),
      bathrooms: parseBathrooms(raw.bathrooms),
      year_built: parseIntOrNull(raw.year_built),
      stories: parseIntOrNull(raw.stories),
      style: raw.style || null,
      square_ft: parseIntOrNull(raw.square_ft),
    };
  } catch (err) {
    console.error(`  Error: ${err.message}`);
    return null;
  }
}

/**
 * Get properties that need scraping
 */
async function getPropertiesToScrape(pool, limit = null) {
  const query = `
    SELECT id, parcel_id, address
    FROM sales
    WHERE valid_comp = true
      AND bedrooms IS NULL
      AND county = 'Fulton'
    ORDER BY sale_date DESC
    ${limit ? `LIMIT ${limit}` : ''}
  `;
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Update property with scraped details
 */
async function updateProperty(pool, id, details) {
  await pool.query(`
    UPDATE sales
    SET bedrooms = $1, bathrooms = $2, year_built = $3, stories = $4, style = $5
    WHERE id = $6
  `, [
    details.bedrooms,
    details.bathrooms,
    details.year_built,
    details.stories,
    details.style,
    id
  ]);
}

// Main
async function main() {
  console.log(`\n=== Property Details Scraper ===`);
  console.log(`Mode: ${TEST_MODE ? 'TEST (no DB writes)' : 'FULL RUN'}\n`);

  // Connect to database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  // Get properties to scrape
  const properties = await getPropertiesToScrape(pool, TEST_MODE ? TEST_LIMIT : null);
  console.log(`Found ${properties.length} properties to scrape\n`);

  if (properties.length === 0) {
    console.log('No properties need scraping.');
    await pool.end();
    return;
  }

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  let success = 0;
  let failed = 0;
  let noData = 0;

  for (let i = 0; i < properties.length; i++) {
    const { id, parcel_id, address } = properties[i];
    console.log(`[${i + 1}/${properties.length}] ${address}`);

    const details = await scrapeProperty(page, parcel_id);

    if (details && details.bedrooms !== null) {
      console.log(`  ✓ ${details.bedrooms}bd/${details.bathrooms}ba, ${details.square_ft}sqft, ${details.year_built}, ${details.style}`);

      if (!TEST_MODE) {
        await updateProperty(pool, id, details);
      }
      success++;
    } else if (details) {
      console.log(`  - No residential data found`);
      noData++;
    } else {
      console.log(`  ✗ Failed to scrape`);
      failed++;
    }

    // Delay between requests
    if (i < properties.length - 1) {
      await page.waitForTimeout(DELAY_MS);
    }
  }

  await browser.close();
  await pool.end();

  console.log(`\n=== Summary ===`);
  console.log(`Success: ${success}`);
  console.log(`No data: ${noData}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${properties.length}`);
}

main().catch(console.error);
