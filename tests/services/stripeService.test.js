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

// Test with STRIPE_SECRET_KEY set (mock the stripe module)
describe('Stripe Service (configured)', () => {
  const mockCreate = jest.fn();
  const mockConstructEvent = jest.fn();

  let stripeService;

  beforeAll(async () => {
    // Must mock stripe before importing service
    jest.unstable_mockModule('stripe', () => {
      return {
        default: jest.fn().mockImplementation(() => ({
          checkout: {
            sessions: {
              create: mockCreate
            }
          },
          webhooks: {
            constructEvent: mockConstructEvent
          }
        }))
      };
    });

    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock';

    jest.resetModules();
    stripeService = await import('../../src/services/stripeService.js');
  });

  afterAll(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  beforeEach(() => {
    mockCreate.mockClear();
    mockConstructEvent.mockClear();
  });

  it('should create a checkout session with correct parameters', async () => {
    const mockSession = { id: 'cs_test_123', url: 'https://checkout.stripe.com/pay/cs_test_123' };
    mockCreate.mockResolvedValue(mockSession);

    const result = await stripeService.createCheckoutSession({
      shortCode: '6774e',
      recipientName: 'Christopher Porcelli',
      address: '6774 Encore Blvd',
      email: 'buyer@example.com',
      successUrl: 'https://lowerproptax.com/r/6774e/success',
      cancelUrl: 'https://lowerproptax.com/r/6774e'
    });

    expect(result).toEqual(mockSession);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: 'buyer@example.com',
        metadata: expect.objectContaining({
          short_code: '6774e',
          recipient_name: 'Christopher Porcelli',
          address: '6774 Encore Blvd'
        }),
        line_items: expect.arrayContaining([
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 9900,
              currency: 'usd'
            })
          })
        ])
      })
    );
  });

  it('should handle undefined email by passing undefined as customer_email', async () => {
    mockCreate.mockResolvedValue({ id: 'cs_test_456', url: 'https://checkout.stripe.com/test' });

    await stripeService.createCheckoutSession({
      shortCode: 'test',
      recipientName: 'Test',
      address: '123 Main',
      email: undefined,
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel'
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_email: undefined
      })
    );
  });

  it('should construct webhook event with correct parameters', () => {
    const mockEvent = { type: 'checkout.session.completed', data: {} };
    mockConstructEvent.mockReturnValue(mockEvent);

    const result = stripeService.constructWebhookEvent('raw_body', 'sig_header');

    expect(result).toEqual(mockEvent);
    expect(mockConstructEvent).toHaveBeenCalledWith('raw_body', 'sig_header', 'whsec_test_mock');
  });
});
