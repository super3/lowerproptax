/**
 * Import sales data from xlsx files into the database
 *
 * Usage: node scripts/importSales.js <xlsx-file> <county> <state>
 * Example: node scripts/importSales.js data/fulton-jan-2025.xlsx "Fulton" "GA"
 */

import 'dotenv/config';
import XLSX from 'xlsx';
import pg from 'pg';
import { resolve } from 'path';

const { Pool } = pg;

// Parse command line arguments
const [,, xlsxPath, county, state] = process.argv;

if (!xlsxPath || !county || !state) {
  console.error('Usage: node scripts/importSales.js <xlsx-file> <county> <state>');
  console.error('Example: node scripts/importSales.js data/fulton-jan-2025.xlsx "Fulton" "GA"');
  process.exit(1);
}

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Parse price string to decimal
 * @param {string} priceStr - Price string like "$45,000.00"
 * @returns {number|null}
 */
function parsePrice(priceStr) {
  if (!priceStr) return null;
  const cleaned = String(priceStr).replace(/[$,]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse date string to Date object
 * @param {string} dateStr - Date string like "1/10/2025"
 * @returns {Date|null}
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * County-specific column mappings
 * Maps our schema fields to the column names in each county's xlsx export
 */
const COLUMN_MAPPINGS = {
  Fulton: {
    parcel_id: 'Parcel ID',
    address: 'Address',
    sale_date: 'Sale Date',
    sale_price: 'Sale Price',
    square_ft: 'Square Ft ',
    year_built: 'Year  Built ',
    acres: 'Acres',
    property_class: 'Parcel  Class ',
  },
  Cobb: {
    parcel_id: 'Parcel ID',
    address: 'Street Name',
    sale_date: 'Sale Date',
    sale_price: 'Sale Price',
    square_ft: 'Square Ft ',
    acres: 'Acres',
  }
};

/**
 * County-specific logic to determine if a sale is valid for comps
 */
function isValidComp(row, county) {
  const price = parsePrice(row['Sale Price']);

  if (county === 'Fulton') {
    const qualified = row['Qualified Sales'];
    const validity = row['Sales Validity'];
    return qualified === 'Qualified' && validity === 'Valid Sale';
  }

  if (county === 'Cobb') {
    // Cobb doesn't have validity fields, use price heuristic
    return price !== null && price > 1000;
  }

  // Default: valid if price > 1000
  return price !== null && price > 1000;
}

/**
 * Get value from row using county-specific column mapping
 */
function getValue(row, field, county) {
  const mapping = COLUMN_MAPPINGS[county];
  if (!mapping) {
    throw new Error(`No column mapping defined for county: ${county}`);
  }
  const columnName = mapping[field];
  return columnName ? row[columnName] : null;
}

/**
 * Import a single xlsx file using batch inserts
 */
async function importFile(filePath, county, state) {
  console.log(`\nImporting: ${filePath}`);
  console.log(`County: ${county}, State: ${state}`);

  // Verify we have a mapping for this county
  if (!COLUMN_MAPPINGS[county]) {
    console.error(`Error: No column mapping defined for county "${county}"`);
    console.error(`Available counties: ${Object.keys(COLUMN_MAPPINGS).join(', ')}`);
    process.exit(1);
  }

  // Read xlsx file
  const absolutePath = resolve(filePath);
  const workbook = XLSX.readFile(absolutePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  console.log(`Found ${rows.length} rows`);

  // Prepare all valid rows, deduping by parcel_id + sale_date
  const seen = new Map();
  let skipped = 0;

  for (const row of rows) {
    const saleDate = parseDate(getValue(row, 'sale_date', county));
    if (!saleDate) {
      skipped++;
      continue;
    }

    const parcelId = getValue(row, 'parcel_id', county);
    const key = `${parcelId}|${saleDate.toISOString()}`;

    // Keep last occurrence (overwrites previous)
    const yearBuilt = getValue(row, 'year_built', county);
    const squareFt = getValue(row, 'square_ft', county);

    seen.set(key, [
      parcelId,
      getValue(row, 'address', county),
      county,
      state,
      saleDate,
      parsePrice(getValue(row, 'sale_price', county)),
      isValidComp(row, county),
      squareFt ? parseInt(squareFt) : null,
      yearBuilt ? parseInt(yearBuilt) : null,
      getValue(row, 'acres', county) || null,
      getValue(row, 'property_class', county)?.trim() || null,
    ]);
  }

  const validRows = Array.from(seen.values());
  const dupes = rows.length - skipped - validRows.length;
  if (dupes > 0) {
    console.log(`Deduped ${dupes} duplicate rows`);
  }

  // Batch insert (100 rows at a time)
  const BATCH_SIZE = 100;
  let imported = 0;
  let errors = 0;

  for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
    const batch = validRows.slice(i, i + BATCH_SIZE);

    // Build multi-row VALUES clause
    const values = [];
    const params = [];
    batch.forEach((row, idx) => {
      const offset = idx * 11;
      values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11})`);
      params.push(...row);
    });

    try {
      await pool.query(`
        INSERT INTO sales (
          parcel_id, address, county, state,
          sale_date, sale_price, valid_comp,
          square_ft, year_built, acres, property_class
        ) VALUES ${values.join(', ')}
        ON CONFLICT (parcel_id, sale_date) DO UPDATE SET
          address = EXCLUDED.address,
          sale_price = EXCLUDED.sale_price,
          valid_comp = EXCLUDED.valid_comp,
          square_ft = EXCLUDED.square_ft,
          year_built = EXCLUDED.year_built,
          acres = EXCLUDED.acres,
          property_class = EXCLUDED.property_class
      `, params);
      imported += batch.length;
    } catch (err) {
      console.error(`Batch error:`, err.message);
      errors += batch.length;
    }
  }

  console.log(`\nImport complete:`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);

  return { imported, skipped, errors };
}

// Run import
try {
  await importFile(xlsxPath, county, state);
} catch (err) {
  console.error('Import failed:', err);
  process.exit(1);
} finally {
  await pool.end();
}
