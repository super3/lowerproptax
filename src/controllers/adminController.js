import pool from '../db/connection.js';
import * as XLSX from 'xlsx';

// Default report year - set to 2025 since 2026 bills aren't out yet
const DEFAULT_REPORT_YEAR = 2025;

// Fetch a user's primary email address from the Clerk API
async function fetchUserEmailFromClerk(userId) {
  const clerkApiKey = process.env.CLERK_SECRET_KEY;
  if (!clerkApiKey || !userId) return null;

  try {
    const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: { 'Authorization': `Bearer ${clerkApiKey}` }
    });

    if (!response.ok) return null;

    const user = await response.json();
    return user.email_addresses?.[0]?.email_address || null;
  } catch (error) {
    console.error('Error fetching user from Clerk:', error);
    return null;
  }
}

// Get all pending properties (status = 'preparing')
export async function getPendingProperties(req, res) {
  try {
    const query = `
      SELECT
        p.id,
        p.address,
        p.city,
        p.state,
        p.zip_code,
        a.status,
        p.created_at,
        p.user_id
      FROM properties p
      LEFT JOIN assessments a ON p.id = a.property_id
        AND a.year = (SELECT MAX(year) FROM assessments WHERE property_id = p.id)
      WHERE a.status = 'preparing' OR a.status IS NULL
      ORDER BY p.created_at ASC
    `;

    const result = await pool.query(query);

    // Ensure status defaults to 'preparing' if null
    const properties = result.rows.map(prop => ({
      ...prop,
      status: prop.status || 'preparing'
    }));

    res.json(properties);
  } catch (error) {
    console.error('Error fetching pending properties:', error);
    res.status(500).json({ error: 'Failed to fetch pending properties' });
  }
}

// Get all completed properties (status = 'ready' or 'invalid')
export async function getCompletedProperties(req, res) {
  try {
    const query = `
      SELECT
        p.id,
        p.address,
        p.city,
        p.state,
        p.zip_code,
        a.status,
        p.created_at,
        p.updated_at,
        p.user_id
      FROM properties p
      LEFT JOIN assessments a ON p.id = a.property_id
        AND a.year = (SELECT MAX(year) FROM assessments WHERE property_id = p.id)
      WHERE a.status IN ('ready', 'invalid')
      ORDER BY p.updated_at DESC
    `;

    const result = await pool.query(query);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching completed properties:', error);
    res.status(500).json({ error: 'Failed to fetch completed properties' });
  }
}

// Get a single property details for admin editing
export async function getPropertyDetails(req, res) {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        id,
        address,
        city,
        state,
        zip_code as "zipCode",
        country,
        lat,
        lng,
        bedrooms,
        bathrooms,
        sqft,
        homestead,
        qpublic_url as "qpublicUrl",
        parcel_number as "parcelNumber",
        tax_record_url as "taxRecordUrl",
        created_at as "createdAt",
        updated_at as "updatedAt",
        user_id as "userId"
      FROM properties
      WHERE id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const property = result.rows[0];

    // Get assessments for this property
    const assessmentsResult = await pool.query(
      `SELECT id, year, annual_tax as "annualTax",
              estimated_annual_tax as "estimatedAnnualTax", report_url as "reportUrl",
              status, created_at as "createdAt", updated_at as "updatedAt"
       FROM assessments
       WHERE property_id = $1
       ORDER BY year DESC`,
      [id]
    );

    property.assessments = assessmentsResult.rows;

    // Get the latest assessment (by year) or create default
    // First try to find the latest assessment (results are already ordered by year DESC)
    const latestAssessment = assessmentsResult.rows[0];

    property.currentAssessment = latestAssessment || {
      year: DEFAULT_REPORT_YEAR,
      annualTax: null,
      estimatedAnnualTax: null,
      reportUrl: null,
      status: 'preparing'
    };

    // Fetch user email from Clerk
    property.userEmail = await fetchUserEmailFromClerk(property.userId);

    res.json(property);
  } catch (error) {
    console.error('Error fetching property details:', error);
    res.status(500).json({ error: 'Failed to fetch property details' });
  }
}

// Update property details
export async function updatePropertyDetails(req, res) {
  try {
    const { id } = req.params;
    const {
      bedrooms,
      bathrooms,
      sqft,
      homestead,
      qpublicUrl,
      parcelNumber,
      taxRecordUrl,
      year,
      annualTax,
      estimatedAnnualTax,
      reportUrl,
      status
    } = req.body;

    // Update property (bedrooms, bathrooms, sqft, homestead, qpublic_url, parcel_number, tax_record_url)
    const propertyQuery = `
      UPDATE properties
      SET
        bedrooms = COALESCE($1, bedrooms),
        bathrooms = COALESCE($2, bathrooms),
        sqft = COALESCE($3, sqft),
        homestead = COALESCE($4, homestead),
        qpublic_url = COALESCE($5, qpublic_url),
        parcel_number = COALESCE($6, parcel_number),
        tax_record_url = COALESCE($7, tax_record_url),
        updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `;

    const propertyResult = await pool.query(propertyQuery, [
      bedrooms !== undefined ? bedrooms : null,
      bathrooms !== undefined ? bathrooms : null,
      sqft !== undefined ? sqft : null,
      homestead !== undefined ? homestead : null,
      qpublicUrl !== undefined ? qpublicUrl : null,
      parcelNumber !== undefined ? parcelNumber : null,
      taxRecordUrl !== undefined ? taxRecordUrl : null,
      id
    ]);

    if (propertyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Get the latest assessment year for this property if no year is specified
    let assessmentYear = year;
    if (!assessmentYear) {
      const latestAssessmentResult = await pool.query(
        'SELECT year FROM assessments WHERE property_id = $1 ORDER BY year DESC LIMIT 1',
        [id]
      );
      assessmentYear = latestAssessmentResult.rows[0]?.year || DEFAULT_REPORT_YEAR;
    }

    const assessmentQuery = `
      INSERT INTO assessments (id, property_id, year, annual_tax,
                               estimated_annual_tax, report_url,
                               status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (property_id, year)
      DO UPDATE SET
        annual_tax = COALESCE($4, assessments.annual_tax),
        estimated_annual_tax = COALESCE($5, assessments.estimated_annual_tax),
        report_url = COALESCE($6, assessments.report_url),
        status = COALESCE($7, assessments.status),
        updated_at = NOW()
      RETURNING *
    `;

    const assessmentId = `assess_${id}_${assessmentYear}`;
    const assessmentResult = await pool.query(assessmentQuery, [
      assessmentId,
      id,
      assessmentYear,
      annualTax !== undefined ? annualTax : null,
      estimatedAnnualTax !== undefined ? estimatedAnnualTax : null,
      reportUrl !== undefined ? reportUrl : null,
      status !== undefined ? status : null
    ]);

    // Return combined result
    const response = {
      ...propertyResult.rows[0],
      currentAssessment: assessmentResult.rows[0]
    };

    res.json(response);
  } catch (error) {
    console.error('Error updating property details:', error);
    res.status(500).json({ error: 'Failed to update property details' });
  }
}

// Generate a short code from address (e.g. "6774 Encore Blvd" → "6774e")
function generateShortCode(address) {
  const parts = address.trim().split(/\s+/);
  const number = parts[0] || '';
  const street = (parts[1] || '').toLowerCase();
  return `${number}${street.charAt(0)}`;
}

// Upload XLSX with mailed properties into a campaign
export async function uploadMailedProperties(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Spreadsheet is empty' });
    }

    // Create a campaign for this upload
    const campaignName = req.body.campaignName || `Upload ${new Date().toISOString().split('T')[0]}`;
    const campaignId = `camp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    await pool.query(
      `INSERT INTO campaigns (id, name, county, state, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [campaignId, campaignName, req.body.county || null, req.body.state || 'GA']
    );

    const results = { imported: 0, skipped: 0, errors: [] };

    for (const row of rows) {
      try {
        // Flexible column mapping - try common column names
        const address = row['Address'] || row['address'] || row['Street Address'] || row['street_address'] || '';
        const city = row['City'] || row['city'] || '';
        const state = row['State'] || row['state'] || 'GA';
        const zipCode = row['Zip'] || row['zip'] || row['Zip Code'] || row['zip_code'] || '';
        const recipientName = row['Owner'] || row['owner'] || row['Owner Name'] || row['owner_name'] || row['Name'] || row['name'] || '';
        const sqft = parseInt(row['Sqft'] || row['sqft'] || row['SqFt'] || row['Square Feet'] || row['square_feet'] || 0) || null;
        const annualTax = parseFloat(row['Tax'] || row['tax'] || row['Property Tax'] || row['property_tax'] || row['Annual Tax'] || row['annual_tax'] || row['2025 Property Tax'] || 0) || null;
        const estimatedSavings = parseFloat(row['Estimated Savings'] || row['estimated_savings'] || row['Savings'] || row['savings'] || 0) || null;

        // Comparable properties (up to 3)
        const comps = [];
        for (let i = 1; i <= 3; i++) {
          const compAddr = row[`Comp ${i} Address`] || row[`comp_${i}_address`] || row[`Comp${i} Address`] || '';
          const compSqft = parseInt(row[`Comp ${i} Sqft`] || row[`comp_${i}_sqft`] || row[`Comp${i} Sqft`] || 0) || null;
          const compTax = parseFloat(row[`Comp ${i} Tax`] || row[`comp_${i}_tax`] || row[`Comp${i} Tax`] || 0) || null;
          if (compAddr) {
            comps.push({ address: compAddr, sqft: compSqft, tax: compTax });
          }
        }

        if (!address) {
          results.errors.push(`Row skipped: no address found`);
          results.skipped++;
          continue;
        }

        // Generate short code
        let shortCode = (row['Short Code'] || row['short_code'] || row['Referral Code'] || row['referral_code'] || '').toString().trim();
        if (!shortCode) {
          shortCode = generateShortCode(address);
        }

        // Check if short code already exists
        const existing = await pool.query('SELECT id FROM mail_recipients WHERE short_code = $1', [shortCode]);
        if (existing.rows.length > 0) {
          results.errors.push(`${address}: short code "${shortCode}" already exists, skipped`);
          results.skipped++;
          continue;
        }

        const recipientId = `mail_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        // Insert mail recipient
        await pool.query(`
          INSERT INTO mail_recipients (id, campaign_id, short_code, recipient_name, address, city, state, zip_code,
            sqft, annual_tax, estimated_savings, comparables, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        `, [recipientId, campaignId, shortCode, recipientName, address, city, state, zipCode,
            sqft, annualTax, estimatedSavings, comps.length > 0 ? JSON.stringify(comps) : null]);

        results.imported++;
      } catch (rowError) {
        results.errors.push(`Row error: ${rowError.message}`);
        results.skipped++;
      }
    }

    res.json({
      message: `Import complete: ${results.imported} imported, ${results.skipped} skipped`,
      campaignId,
      ...results
    });
  } catch (error) {
    console.error('Error uploading mailed properties:', error);
    res.status(500).json({ error: 'Failed to process upload' });
  }
}

// Get all mailed properties (across all campaigns)
export async function getMailedProperties(req, res) {
  try {
    const query = `
      SELECT
        mr.id,
        mr.address,
        mr.city,
        mr.state,
        mr.zip_code,
        mr.recipient_name,
        mr.short_code,
        mr.sqft,
        mr.annual_tax,
        mr.estimated_savings,
        mr.payment_status,
        mr.page_views,
        mr.last_viewed_at,
        mr.created_at,
        c.name as campaign_name
      FROM mail_recipients mr
      JOIN campaigns c ON mr.campaign_id = c.id
      ORDER BY mr.created_at DESC
    `;

    const result = await pool.query(query);

    // Calculate stats
    const totalMailed = result.rows.length;
    const totalVisited = result.rows.filter(r => parseInt(r.page_views) > 0).length;

    res.json({
      properties: result.rows,
      stats: {
        totalMailed,
        totalVisited,
        visitRate: totalMailed > 0 ? ((totalVisited / totalMailed) * 100).toFixed(1) : '0.0'
      }
    });
  } catch (error) {
    console.error('Error fetching mailed properties:', error);
    res.status(500).json({ error: 'Failed to fetch mailed properties' });
  }
}
