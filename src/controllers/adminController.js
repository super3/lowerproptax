import pool from '../db/connection.js';
import { sendAssessmentReadyNotification } from '../services/emailService.js';
import { parseAddressForScraping } from '../../scripts/address-parser.js';
import { scrapeProperty } from '../../scripts/county-scraper.js';

// Default report year - set to 2025 since 2026 bills aren't out yet
const DEFAULT_REPORT_YEAR = 2025;

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
    try {
      const clerkApiKey = process.env.CLERK_SECRET_KEY;
      if (clerkApiKey && property.userId) {
        const clerkResponse = await fetch(`https://api.clerk.com/v1/users/${property.userId}`, {
          headers: {
            'Authorization': `Bearer ${clerkApiKey}`
          }
        });

        if (clerkResponse.ok) {
          const clerkUser = await clerkResponse.json();
          property.userEmail = clerkUser.email_addresses?.[0]?.email_address || null;
        } else {
          property.userEmail = null;
        }
      } else {
        property.userEmail = null;
      }
    } catch (clerkError) {
      console.error('Error fetching user from Clerk:', clerkError);
      property.userEmail = null;
    }

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
      year,
      annualTax,
      estimatedAnnualTax,
      reportUrl,
      status
    } = req.body;

    // Update property (bedrooms, bathrooms, sqft, homestead, qpublic_url, parcel_number)
    const propertyQuery = `
      UPDATE properties
      SET
        bedrooms = COALESCE($1, bedrooms),
        bathrooms = COALESCE($2, bathrooms),
        sqft = COALESCE($3, sqft),
        homestead = COALESCE($4, homestead),
        qpublic_url = COALESCE($5, qpublic_url),
        parcel_number = COALESCE($6, parcel_number),
        updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `;

    const propertyResult = await pool.query(propertyQuery, [
      bedrooms !== undefined ? bedrooms : null,
      bathrooms !== undefined ? bathrooms : null,
      sqft !== undefined ? sqft : null,
      homestead !== undefined ? homestead : null,
      qpublicUrl !== undefined ? qpublicUrl : null,
      parcelNumber !== undefined ? parcelNumber : null,
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

    // Send email notification if status was set to 'ready'
    if (status === 'ready') {
      const property = propertyResult.rows[0];
      const assessment = {
        annualTax: assessmentResult.rows[0].annual_tax,
        estimatedAnnualTax: assessmentResult.rows[0].estimated_annual_tax
      };

      // Fetch user email from Clerk
      try {
        const clerkApiKey = process.env.CLERK_SECRET_KEY;
        if (clerkApiKey && property.user_id) {
          const clerkResponse = await fetch(`https://api.clerk.com/v1/users/${property.user_id}`, {
            headers: { 'Authorization': `Bearer ${clerkApiKey}` }
          });

          if (clerkResponse.ok) {
            const clerkUser = await clerkResponse.json();
            const userEmail = clerkUser.email_addresses?.[0]?.email_address;
            if (userEmail) {
              /* istanbul ignore next */
              sendAssessmentReadyNotification(property, assessment, userEmail).catch(() => {});
            }
          }
        }
      } catch (clerkError) {
        console.error('Error fetching user for notification:', clerkError);
      }
    }

    res.json(response);
  } catch (error) {
    console.error('Error updating property details:', error);
    res.status(500).json({ error: 'Failed to update property details' });
  }
}

// Mark property as ready (legacy function, kept for backward compatibility)
export async function markPropertyAsReady(req, res) {
  try {
    const { id } = req.params;

    const query = `
      UPDATE properties
      SET status = 'ready', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error marking property as ready:', error);
    res.status(500).json({ error: 'Failed to mark property as ready' });
  }
}

// Pull property data from county website
export async function pullPropertyData(req, res) {
  try {
    const { id } = req.params;

    // Get property address
    const query = `
      SELECT address, city, state, zip_code
      FROM properties
      WHERE id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const property = result.rows[0];

    // Build full address
    const fullAddress = `${property.address}, ${property.city}, ${property.state}, ${property.zip_code}`;

    // Parse address to get county and clean street address
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    let parsed;
    try {
      parsed = await parseAddressForScraping(fullAddress, apiKey);
    } catch (parseError) {
      return res.status(400).json({
        error: 'Address not in supported county',
        message: parseError.message
      });
    }

    // Scrape property data from county website
    const scraperResult = await scrapeProperty(parsed.streetAddress, parsed.county);

    if (!scraperResult) {
      return res.status(400).json({
        error: 'Failed to scrape property data',
        message: 'Could not find property on county website'
      });
    }

    // Return scraped data (not saved to database)
    res.json({
      bedrooms: scraperResult.bedrooms,
      bathrooms: scraperResult.bathrooms,
      sqft: scraperResult.sqft,
      homesteadExemption: scraperResult.homesteadExemption,
      qpublicUrl: scraperResult.qpublicUrl,
      parcelNumber: scraperResult.parcelNumber,
      propertyTax2025: scraperResult.propertyTax2025,
      county: parsed.county,
      streetAddress: parsed.streetAddress
    });
  } catch (error) {
    console.error('Error pulling property data:', error);
    res.status(500).json({ error: 'Failed to pull property data' });
  }
}
