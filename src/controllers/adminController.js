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

// Mark property as ready
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
