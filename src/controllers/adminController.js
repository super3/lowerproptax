import pool from '../db/connection.js';

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
        p.status,
        p.created_at,
        p.user_id
      FROM properties p
      WHERE p.status = 'preparing'
      ORDER BY p.created_at ASC
    `;

    const result = await pool.query(query);

    // For now, we don't have user email in the database
    // In production, you'd join with a users table or fetch from Clerk
    const properties = result.rows.map(prop => ({
      ...prop,
      user_email: null  // TODO: Fetch from Clerk API using user_id
    }));

    res.json(properties);
  } catch (error) {
    console.error('Error fetching pending properties:', error);
    res.status(500).json({ error: 'Failed to fetch pending properties' });
  }
}

// Get all completed properties (status = 'ready')
export async function getCompletedProperties(req, res) {
  try {
    const query = `
      SELECT
        p.id,
        p.address,
        p.city,
        p.state,
        p.zip_code,
        p.status,
        p.created_at,
        p.updated_at,
        p.user_id
      FROM properties p
      WHERE p.status = 'ready'
      ORDER BY p.updated_at DESC
    `;

    const result = await pool.query(query);

    // For now, we don't have user email in the database
    // In production, you'd join with a users table or fetch from Clerk
    const properties = result.rows.map(prop => ({
      ...prop,
      user_email: null  // TODO: Fetch from Clerk API using user_id
    }));

    res.json(properties);
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
        zip_code,
        country,
        lat,
        lng,
        bedrooms,
        bathrooms,
        sqft,
        created_at,
        updated_at,
        user_id
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
      `SELECT id, year, appraised_value, annual_tax, status, created_at, updated_at
       FROM assessments
       WHERE property_id = $1
       ORDER BY year DESC`,
      [id]
    );

    property.assessments = assessmentsResult.rows;

    // Get current year's assessment or create default
    const currentYear = new Date().getFullYear();
    const currentAssessment = assessmentsResult.rows.find(a => a.year === currentYear);

    property.currentAssessment = currentAssessment || {
      year: currentYear,
      appraised_value: null,
      annual_tax: null,
      status: 'preparing'
    };

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
      year,
      appraised_value,
      annual_tax,
      status
    } = req.body;

    // Update property (bedrooms, bathrooms, sqft)
    const propertyQuery = `
      UPDATE properties
      SET
        bedrooms = COALESCE($1, bedrooms),
        bathrooms = COALESCE($2, bathrooms),
        sqft = COALESCE($3, sqft),
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;

    const propertyResult = await pool.query(propertyQuery, [
      bedrooms !== undefined ? bedrooms : null,
      bathrooms !== undefined ? bathrooms : null,
      sqft !== undefined ? sqft : null,
      id
    ]);

    if (propertyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Update or create assessment for the specified year (or current year if not specified)
    const assessmentYear = year || new Date().getFullYear();

    const assessmentQuery = `
      INSERT INTO assessments (id, property_id, year, appraised_value, annual_tax, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (property_id, year)
      DO UPDATE SET
        appraised_value = COALESCE($4, assessments.appraised_value),
        annual_tax = COALESCE($5, assessments.annual_tax),
        status = COALESCE($6, assessments.status),
        updated_at = NOW()
      RETURNING *
    `;

    const assessmentId = `assess_${id}_${assessmentYear}`;
    const assessmentResult = await pool.query(assessmentQuery, [
      assessmentId,
      id,
      assessmentYear,
      appraised_value !== undefined ? appraised_value : null,
      annual_tax !== undefined ? annual_tax : null,
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
