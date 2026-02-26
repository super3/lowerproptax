import { jest } from '@jest/globals';

// Test with no STRIPE_SECRET_KEY set
describe('Stripe Service (unconfigured)', () => {
  let stripeService;

  beforeAll(async () => {
    delete process.env.STRIPE_SECRET_KEY;
    stripeService = await import('../../src/services/stripeService.js');
  });

  it('should return null when creating checkout session without Stripe configured', async () => {
    const result = await stripeService.createCheckoutSession({
      shortCode: 'test',
      recipientName: 'Test User',
      address: '123 Main St',
      email: 'test@example.com',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel'
    });

    expect(result).toBeNull();
  });

  it('should throw when constructing webhook event without Stripe configured', () => {
    expect(() => {
      stripeService.constructWebhookEvent('payload', 'signature');
    }).toThrow('Stripe not configured');
  });
});
