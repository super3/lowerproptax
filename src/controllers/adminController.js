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
        appraised_value,
        annual_tax,
        status,
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

    res.json(result.rows[0]);
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
      appraised_value,
      annual_tax,
      status
    } = req.body;

    const query = `
      UPDATE properties
      SET
        bedrooms = COALESCE($1, bedrooms),
        bathrooms = COALESCE($2, bathrooms),
        sqft = COALESCE($3, sqft),
        appraised_value = COALESCE($4, appraised_value),
        annual_tax = COALESCE($5, annual_tax),
        status = COALESCE($6, status),
        updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `;

    const result = await pool.query(query, [
      bedrooms !== undefined ? bedrooms : null,
      bathrooms !== undefined ? bathrooms : null,
      sqft !== undefined ? sqft : null,
      appraised_value !== undefined ? appraised_value : null,
      annual_tax !== undefined ? annual_tax : null,
      status !== undefined ? status : null,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json(result.rows[0]);
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
