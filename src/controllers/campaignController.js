import pool from '../db/connection.js';

// Generate a short code from an address (e.g. "6774 Encore Blvd" → "6774e")
function generateShortCode(address) {
  const parts = address.trim().split(/\s+/);
  const number = parts[0] || '';
  const street = (parts[1] || '').toLowerCase();
  return `${number}${street.charAt(0)}`;
}

// List all campaigns
export async function getCampaigns(req, res) {
  try {
    const result = await pool.query(
      `SELECT c.id, c.name, c.county, c.state, c.deadline,
              c.created_at as "createdAt", c.updated_at as "updatedAt",
              COUNT(mr.id) as "recipientCount",
              COUNT(CASE WHEN mr.payment_status = 'paid' THEN 1 END) as "paidCount",
              SUM(mr.page_views) as "totalViews"
       FROM campaigns c
       LEFT JOIN mail_recipients mr ON mr.campaign_id = c.id
       GROUP BY c.id
       ORDER BY c.created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
}

// Create a new campaign
export async function createCampaign(req, res) {
  try {
    const { name, county, state, deadline } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Campaign name is required' });
    }

    const id = `camp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await pool.query(
      `INSERT INTO campaigns (id, name, county, state, deadline, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, name, county, state, deadline,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [id, name, county || null, state || null, deadline || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
}

// Get campaign details with recipients
export async function getCampaignDetails(req, res) {
  try {
    const { id } = req.params;

    const campaignResult = await pool.query(
      `SELECT id, name, county, state, deadline,
              created_at as "createdAt", updated_at as "updatedAt"
       FROM campaigns WHERE id = $1`,
      [id]
    );

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const campaign = campaignResult.rows[0];

    const recipientsResult = await pool.query(
      `SELECT id, short_code as "shortCode", recipient_name as "recipientName",
              address, city, state, zip_code as "zipCode",
              sqft, annual_tax as "annualTax", estimated_savings as "estimatedSavings",
              comparables, report_url as "reportUrl", email,
              payment_status as "paymentStatus", paid_at as "paidAt",
              page_views as "pageViews", last_viewed_at as "lastViewedAt",
              created_at as "createdAt"
       FROM mail_recipients
       WHERE campaign_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    campaign.recipients = recipientsResult.rows;

    res.json(campaign);
  } catch (error) {
    console.error('Error fetching campaign details:', error);
    res.status(500).json({ error: 'Failed to fetch campaign details' });
  }
}

// Add a recipient to a campaign
export async function addRecipient(req, res) {
  try {
    const { id: campaignId } = req.params;
    const {
      recipientName, address, city, state, zipCode,
      sqft, annualTax, estimatedSavings, comparables, reportUrl, shortCode
    } = req.body;

    if (!recipientName || !address) {
      return res.status(400).json({ error: 'Recipient name and address are required' });
    }

    // Verify campaign exists
    const campaignCheck = await pool.query('SELECT id FROM campaigns WHERE id = $1', [campaignId]);
    if (campaignCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const id = `mail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const code = shortCode || generateShortCode(address);

    const result = await pool.query(
      `INSERT INTO mail_recipients
        (id, campaign_id, short_code, recipient_name, address, city, state, zip_code,
         sqft, annual_tax, estimated_savings, comparables, report_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
       RETURNING id, short_code as "shortCode", recipient_name as "recipientName",
                 address, city, state, zip_code as "zipCode",
                 sqft, annual_tax as "annualTax", estimated_savings as "estimatedSavings",
                 comparables, report_url as "reportUrl", payment_status as "paymentStatus",
                 created_at as "createdAt"`,
      [
        id, campaignId, code, recipientName, address,
        city || null, state || null, zipCode || null,
        sqft || null, annualTax || null, estimatedSavings || null,
        comparables ? JSON.stringify(comparables) : null,
        reportUrl || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    // Handle unique constraint violation on short_code
    if (error.code === '23505' && error.constraint?.includes('short_code')) {
      return res.status(409).json({ error: 'Short code already exists. Please provide a unique short code.' });
    }
    console.error('Error adding recipient:', error);
    res.status(500).json({ error: 'Failed to add recipient' });
  }
}

// Update a mail recipient
export async function updateRecipient(req, res) {
  try {
    const { recipientId } = req.params;
    const {
      recipientName, address, city, state, zipCode,
      sqft, annualTax, estimatedSavings, comparables, reportUrl, email
    } = req.body;

    const result = await pool.query(
      `UPDATE mail_recipients SET
        recipient_name = COALESCE($1, recipient_name),
        address = COALESCE($2, address),
        city = COALESCE($3, city),
        state = COALESCE($4, state),
        zip_code = COALESCE($5, zip_code),
        sqft = COALESCE($6, sqft),
        annual_tax = COALESCE($7, annual_tax),
        estimated_savings = COALESCE($8, estimated_savings),
        comparables = COALESCE($9, comparables),
        report_url = COALESCE($10, report_url),
        email = COALESCE($11, email),
        updated_at = NOW()
       WHERE id = $12
       RETURNING id, short_code as "shortCode", recipient_name as "recipientName",
                 address, city, state, zip_code as "zipCode",
                 sqft, annual_tax as "annualTax", estimated_savings as "estimatedSavings",
                 comparables, report_url as "reportUrl", email,
                 payment_status as "paymentStatus", page_views as "pageViews",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        recipientName || null, address || null, city || null, state || null, zipCode || null,
        sqft !== undefined ? sqft : null, annualTax !== undefined ? annualTax : null,
        estimatedSavings !== undefined ? estimatedSavings : null,
        comparables ? JSON.stringify(comparables) : null,
        reportUrl || null, email || null,
        recipientId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating recipient:', error);
    res.status(500).json({ error: 'Failed to update recipient' });
  }
}

// Delete a recipient
export async function deleteRecipient(req, res) {
  try {
    const { recipientId } = req.params;

    const result = await pool.query(
      'DELETE FROM mail_recipients WHERE id = $1 RETURNING id',
      [recipientId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    res.json({ message: 'Recipient deleted successfully' });
  } catch (error) {
    console.error('Error deleting recipient:', error);
    res.status(500).json({ error: 'Failed to delete recipient' });
  }
}
