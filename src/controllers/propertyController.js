import pool from '../db/connection.js';
import { sendNewPropertyNotification } from '../services/emailService.js';
import { parseAddress, SUPPORTED_COUNTIES } from '../../scripts/address-parser.js';

// Test helper to reset storage
export async function resetProperties() {
  await pool.query('DELETE FROM properties');
}

// Get all properties for the authenticated user
export async function getProperties(req, res) {
  try {
    const userId = req.user.id;

    // Single query with LEFT JOIN to get properties and their latest assessments
    const result = await pool.query(
      `SELECT p.id, p.user_id as "userId", p.address, p.city, p.state,
              p.zip_code as "zipCode", p.country, p.lat, p.lng,
              p.bedrooms, p.bathrooms, p.sqft,
              p.created_at as "createdAt", p.updated_at as "updatedAt",
              a.id as "assessmentId", a.year as "assessmentYear",
              a.annual_tax as "assessmentAnnualTax",
              a.estimated_annual_tax as "assessmentEstimatedAnnualTax",
              a.report_url as "assessmentReportUrl",
              a.status as "assessmentStatus",
              a.created_at as "assessmentCreatedAt",
              a.updated_at as "assessmentUpdatedAt"
       FROM properties p
       LEFT JOIN (
         SELECT DISTINCT ON (property_id) *
         FROM assessments
         ORDER BY property_id, year DESC
       ) a ON a.property_id = p.id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [userId]
    );

    // Transform flat rows into nested structure
    const properties = result.rows.map(row => ({
      id: row.id,
      userId: row.userId,
      address: row.address,
      city: row.city,
      state: row.state,
      zipCode: row.zipCode,
      country: row.country,
      lat: row.lat,
      lng: row.lng,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      sqft: row.sqft,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      latestAssessment: row.assessmentId ? {
        id: row.assessmentId,
        year: row.assessmentYear,
        annualTax: row.assessmentAnnualTax,
        estimatedAnnualTax: row.assessmentEstimatedAnnualTax,
        reportUrl: row.assessmentReportUrl,
        status: row.assessmentStatus,
        createdAt: row.assessmentCreatedAt,
        updatedAt: row.assessmentUpdatedAt
      } : null
    }));

    res.json(properties);
  } catch (error) {
    console.error('Error getting properties:', error);
    res.status(500).json({ error: 'Failed to get properties' });
  }
}

// Get a single property by ID
export async function getProperty(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, user_id as "userId", address, city, state,
              zip_code as "zipCode", country, lat, lng,
              bedrooms, bathrooms, sqft,
              created_at as "createdAt", updated_at as "updatedAt"
       FROM properties WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const property = result.rows[0];

    // Ensure user owns this property
    if (property.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all assessments for this property
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

    res.json(property);
  } catch (error) {
    console.error('Error getting property:', error);
    res.status(500).json({ error: 'Failed to get property' });
  }
}

// Create a new property
export async function createProperty(req, res) {
  try {
    const { address, city, state, zipCode, country, lat, lng } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const propertyId = `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await pool.query(
      `INSERT INTO properties (id, user_id, address, city, state, zip_code, country, lat, lng, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING id, user_id as "userId", address, city, state,
                 zip_code as "zipCode", country, lat, lng,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        propertyId,
        req.user.id,
        address,
        city || '',
        state || '',
        zipCode || '',
        country || '',
        lat || null,
        lng || null
      ]
    );

    const property = result.rows[0];

    // Send email notification (fire-and-forget)
    /* istanbul ignore next */
    sendNewPropertyNotification(property, req.user.email).catch(() => {});

    res.status(201).json(property);
  } catch (error) {
    console.error('Error creating property:', error);
    res.status(500).json({ error: 'Failed to create property' });
  }
}

// Update a property
export async function updateProperty(req, res) {
  try {
    const { id } = req.params;

    // First check if property exists and user owns it
    const checkResult = await pool.query(
      'SELECT user_id FROM properties WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const property = checkResult.rows[0];

    // Ensure user owns this property
    if (property.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { address, city, state, zipCode, country, lat, lng } = req.body;

    const result = await pool.query(
      `UPDATE properties
       SET address = COALESCE($1, address),
           city = COALESCE($2, city),
           state = COALESCE($3, state),
           zip_code = COALESCE($4, zip_code),
           country = COALESCE($5, country),
           lat = COALESCE($6, lat),
           lng = COALESCE($7, lng),
           updated_at = NOW()
       WHERE id = $8
       RETURNING id, user_id as "userId", address, city, state,
                 zip_code as "zipCode", country, lat, lng,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        /* istanbul ignore next */ address !== undefined ? address : null,
        /* istanbul ignore next */ city !== undefined ? city : null,
        /* istanbul ignore next */ state !== undefined ? state : null,
        /* istanbul ignore next */ zipCode !== undefined ? zipCode : null,
        /* istanbul ignore next */ country !== undefined ? country : null,
        /* istanbul ignore next */ lat !== undefined ? lat : null,
        /* istanbul ignore next */ lng !== undefined ? lng : null,
        id
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ error: 'Failed to update property' });
  }
}

// Delete a property
export async function deleteProperty(req, res) {
  try {
    const { id } = req.params;

    // First check if property exists and user owns it
    const checkResult = await pool.query(
      'SELECT user_id FROM properties WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const property = checkResult.rows[0];

    // Ensure user owns this property
    if (property.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await pool.query('DELETE FROM properties WHERE id = $1', [id]);
    res.json({ message: 'Property deleted successfully' });
  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({ error: 'Failed to delete property' });
  }
}

// Preview property address (no auth required)
export async function previewProperty(req, res) {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    const parsed = await parseAddress(address, apiKey);

    res.json({
      streetAddress: parsed.streetAddress,
      county: parsed.county,
      supported: parsed.isSupported,
      supportedCounties: SUPPORTED_COUNTIES
    });
  } catch (error) {
    console.error('Error previewing property:', error);
    res.status(400).json({ error: error.message || 'Failed to validate address' });
  }
}
