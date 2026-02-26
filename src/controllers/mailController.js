import pool from '../db/connection.js';
import { createCheckoutSession, constructWebhookEvent } from '../services/stripeService.js';
import { sendReportPurchasedNotification } from '../services/emailService.js';

// Look up a mail recipient by short code (public, no auth)
export async function getRecipientByCode(req, res) {
  try {
    const { code } = req.params;

    const result = await pool.query(
      `SELECT
        mr.id, mr.short_code as "shortCode", mr.recipient_name as "recipientName",
        mr.address, mr.city, mr.state, mr.zip_code as "zipCode",
        mr.sqft, mr.annual_tax as "annualTax",
        mr.estimated_savings as "estimatedSavings",
        mr.comparables, mr.payment_status as "paymentStatus",
        mr.report_url as "reportUrl",
        c.name as "campaignName", c.county, c.deadline
       FROM mail_recipients mr
       JOIN campaigns c ON mr.campaign_id = c.id
       WHERE mr.short_code = $1`,
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    const recipient = result.rows[0];

    // Increment page views
    await pool.query(
      `UPDATE mail_recipients SET page_views = page_views + 1, last_viewed_at = NOW() WHERE short_code = $1`,
      [code]
    );

    // Don't expose internal fields to public
    const publicData = {
      shortCode: recipient.shortCode,
      recipientName: recipient.recipientName,
      address: recipient.address,
      city: recipient.city,
      state: recipient.state,
      zipCode: recipient.zipCode,
      sqft: recipient.sqft,
      annualTax: recipient.annualTax,
      estimatedSavings: recipient.estimatedSavings,
      comparables: recipient.comparables,
      paymentStatus: recipient.paymentStatus,
      reportUrl: recipient.paymentStatus === 'paid' ? recipient.reportUrl : null,
      campaignName: recipient.campaignName,
      county: recipient.county,
      deadline: recipient.deadline
    };

    res.json(publicData);
  } catch (error) {
    console.error('Error looking up recipient:', error);
    res.status(500).json({ error: 'Failed to look up recipient' });
  }
}

// Create a Stripe checkout session for a recipient
export async function createCheckout(req, res) {
  try {
    const { code } = req.params;
    const { email } = req.body;

    const result = await pool.query(
      `SELECT id, short_code, recipient_name, address, payment_status
       FROM mail_recipients WHERE short_code = $1`,
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    const recipient = result.rows[0];

    if (recipient.payment_status === 'paid') {
      return res.status(400).json({ error: 'Report already purchased' });
    }

    // Save email if provided
    if (email) {
      await pool.query(
        `UPDATE mail_recipients SET email = $1, updated_at = NOW() WHERE id = $2`,
        [email, recipient.id]
      );
    }

    const baseUrl = process.env.APP_URL || 'https://lowerproptax.com';
    const session = await createCheckoutSession({
      shortCode: recipient.short_code,
      recipientName: recipient.recipient_name,
      address: recipient.address,
      email,
      successUrl: `${baseUrl}/r/${recipient.short_code}/success`,
      cancelUrl: `${baseUrl}/r/${recipient.short_code}`
    });

    if (!session) {
      return res.status(500).json({ error: 'Payment service not configured' });
    }

    // Store stripe session ID
    await pool.query(
      `UPDATE mail_recipients SET stripe_session_id = $1, updated_at = NOW() WHERE id = $2`,
      [session.id, recipient.id]
    );

    res.json({ checkoutUrl: session.url });
  } catch (error) {
    console.error('Error creating checkout:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
}

// Handle Stripe webhook
export async function handleWebhook(req, res) {
  try {
    const signature = req.headers['stripe-signature'];
    let event;

    try {
      event = constructWebhookEvent(req.body, signature);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const shortCode = session.metadata?.short_code;

      if (shortCode) {
        await pool.query(
          `UPDATE mail_recipients
           SET payment_status = 'paid',
               paid_at = NOW(),
               email = COALESCE($1, email),
               updated_at = NOW()
           WHERE short_code = $2`,
          [session.customer_email, shortCode]
        );

        // Fetch recipient for email notification
        const result = await pool.query(
          `SELECT id, recipient_name, address, email, report_url
           FROM mail_recipients WHERE short_code = $1`,
          [shortCode]
        );

        if (result.rows.length > 0) {
          const recipient = result.rows[0];
          if (recipient.email) {
            /* istanbul ignore next */
            sendReportPurchasedNotification(recipient).catch(() => {});
          }
        }
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}
