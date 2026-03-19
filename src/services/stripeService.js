import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export async function createCheckoutSession({ shortCode, recipientName, address, email, successUrl, cancelUrl }) {
  if (!stripe) {
    console.log('Stripe not configured (STRIPE_SECRET_KEY missing)');
    return null;
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Property Tax Savings Report',
          description: `Personalized exemption report for ${address}`
        },
        unit_amount: 9900 // $99.00
      },
      quantity: 1
    }],
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: email || undefined,
    metadata: {
      short_code: shortCode,
      recipient_name: recipientName,
      address
    }
  });

  return session;
}

export function constructWebhookEvent(payload, signature) {
  if (!stripe) {
    throw new Error('Stripe not configured');
  }

  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
}

export default stripe;
