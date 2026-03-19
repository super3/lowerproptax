import { jest } from '@jest/globals';

// Mock the database connection
const mockQuery = jest.fn();
jest.unstable_mockModule('../../src/db/connection.js', () => ({
  default: {
    query: mockQuery
  }
}));

// Mock the stripe service
const mockCreateCheckoutSession = jest.fn();
const mockConstructWebhookEvent = jest.fn();
jest.unstable_mockModule('../../src/services/stripeService.js', () => ({
  createCheckoutSession: mockCreateCheckoutSession,
  constructWebhookEvent: mockConstructWebhookEvent
}));

// Mock the email service
const mockSendReferralVisitNotification = jest.fn().mockResolvedValue();
const mockSendReportPurchasedNotification = jest.fn();
jest.unstable_mockModule('../../src/services/emailService.js', () => ({
  sendReferralVisitNotification: mockSendReferralVisitNotification,
  sendReportPurchasedNotification: mockSendReportPurchasedNotification
}));

// Import after mocking
const mailController = await import('../../src/controllers/mailController.js');

describe('Mail Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      headers: {}
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    mockQuery.mockClear();
    mockCreateCheckoutSession.mockClear();
    mockConstructWebhookEvent.mockClear();
    mockSendReferralVisitNotification.mockClear();
    mockSendReportPurchasedNotification.mockClear();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getRecipientByCode', () => {
    it('should return recipient data for valid short code', async () => {
      req.params.code = '6774e';

      const mockRecipient = {
        id: 'mail_1',
        shortCode: '6774e',
        recipientName: 'Christopher & Heather Porcelli',
        address: '6774 Encore Blvd',
        city: 'Atlanta',
        state: 'GA',
        zipCode: '30328',
        sqft: 2016,
        annualTax: '9331.51',
        estimatedSavings: '1870.21',
        comparables: [{ address: '6765 Prelude Dr', sqft: 1900, annualTax: '7658.91' }],
        paymentStatus: 'unpaid',
        reportUrl: null,
        campaignName: 'Aria Feb 2026',
        county: 'Fulton',
        deadline: '2026-04-01'
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockRecipient] })  // SELECT recipient
        .mockResolvedValueOnce({ rows: [{ page_views: 5 }] }); // UPDATE page views RETURNING

      await mailController.getRecipientByCode(req, res);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE mr.short_code = $1'),
        ['6774e']
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          shortCode: '6774e',
          recipientName: 'Christopher & Heather Porcelli',
          address: '6774 Encore Blvd',
          paymentStatus: 'unpaid',
          reportUrl: null  // Should not expose report URL when unpaid
        })
      );
      expect(mockSendReferralVisitNotification).toHaveBeenCalledWith(
        expect.objectContaining({ address: '6774 Encore Blvd', short_code: '6774e' }),
        expect.objectContaining({ visit_count: 5 })
      );
    });

    it('should expose report URL when payment status is paid', async () => {
      req.params.code = '6774e';

      const mockRecipient = {
        id: 'mail_1',
        shortCode: '6774e',
        recipientName: 'Test User',
        address: '123 Main St',
        city: 'Atlanta',
        state: 'GA',
        zipCode: '30328',
        sqft: 2000,
        annualTax: '5000.00',
        estimatedSavings: '1000.00',
        comparables: [],
        paymentStatus: 'paid',
        reportUrl: 'https://example.com/report.pdf',
        campaignName: 'Test Campaign',
        county: 'Fulton',
        deadline: '2026-04-01'
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockRecipient] })
        .mockResolvedValueOnce({ rows: [{ page_views: 1 }] });

      await mailController.getRecipientByCode(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentStatus: 'paid',
          reportUrl: 'https://example.com/report.pdf'
        })
      );
    });

    it('should return 404 for invalid short code', async () => {
      req.params.code = 'invalid';
      mockQuery.mockResolvedValue({ rows: [] });

      await mailController.getRecipientByCode(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
    });

    it('should handle database errors', async () => {
      req.params.code = '6774e';
      mockQuery.mockRejectedValue(new Error('Database error'));

      await mailController.getRecipientByCode(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to look up recipient' });
    });
  });

  describe('createCheckout', () => {
    it('should create a checkout session for unpaid recipient', async () => {
      req.params.code = '6774e';
      req.body = { email: 'test@example.com' };

      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'mail_1', short_code: '6774e', recipient_name: 'Test User', address: '123 Main St', payment_status: 'unpaid' }]
        })
        .mockResolvedValueOnce({ rows: [] })  // UPDATE email
        .mockResolvedValueOnce({ rows: [] }); // UPDATE stripe_session_id

      mockCreateCheckoutSession.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123'
      });

      await mailController.createCheckout(req, res);

      expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          shortCode: '6774e',
          recipientName: 'Test User',
          address: '123 Main St',
          email: 'test@example.com'
        })
      );
      expect(res.json).toHaveBeenCalledWith({
        checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_123'
      });
    });

    it('should return 400 if already paid', async () => {
      req.params.code = '6774e';

      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'mail_1', short_code: '6774e', recipient_name: 'Test', address: '123 Main St', payment_status: 'paid' }]
      });

      await mailController.createCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Report already purchased' });
    });

    it('should return 404 for invalid code', async () => {
      req.params.code = 'invalid';
      mockQuery.mockResolvedValue({ rows: [] });

      await mailController.createCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
    });

    it('should return 500 if stripe is not configured', async () => {
      req.params.code = '6774e';
      req.body = {};

      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'mail_1', short_code: '6774e', recipient_name: 'Test', address: '123 Main St', payment_status: 'unpaid' }]
      });

      mockCreateCheckoutSession.mockResolvedValue(null);

      await mailController.createCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Payment service not configured' });
    });

    it('should handle errors', async () => {
      req.params.code = '6774e';
      mockQuery.mockRejectedValue(new Error('Database error'));

      await mailController.createCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to create checkout session' });
    });
  });

  describe('handleWebhook', () => {
    it('should process checkout.session.completed event', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { short_code: '6774e' },
            customer_email: 'buyer@example.com'
          }
        }
      };

      req.body = Buffer.from(JSON.stringify(mockEvent));
      req.headers = { 'stripe-signature': 'sig_test' };

      mockConstructWebhookEvent.mockReturnValue(mockEvent);
      mockQuery
        .mockResolvedValueOnce({ rows: [] })  // UPDATE payment_status
        .mockResolvedValueOnce({              // SELECT recipient for email
          rows: [{
            id: 'mail_1',
            recipient_name: 'Test User',
            address: '123 Main St',
            email: 'buyer@example.com',
            report_url: 'https://example.com/report.pdf'
          }]
        });

      mockSendReportPurchasedNotification.mockResolvedValue();

      await mailController.handleWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith({ received: true });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("payment_status = 'paid'"),
        expect.arrayContaining(['buyer@example.com', '6774e'])
      );
    });

    it('should return 400 for invalid signature', async () => {
      req.body = Buffer.from('{}');
      req.headers = { 'stripe-signature': 'invalid' };

      mockConstructWebhookEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await mailController.handleWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
    });

    it('should handle non-checkout events gracefully', async () => {
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: { object: {} }
      };

      req.body = Buffer.from(JSON.stringify(mockEvent));
      req.headers = { 'stripe-signature': 'sig_test' };

      mockConstructWebhookEvent.mockReturnValue(mockEvent);

      await mailController.handleWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    it('should handle webhook processing errors', async () => {
      req.body = Buffer.from('{}');
      req.headers = { 'stripe-signature': 'sig_test' };

      mockConstructWebhookEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: { metadata: { short_code: '6774e' } } }
      });

      mockQuery.mockRejectedValue(new Error('Database error'));

      await mailController.handleWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Webhook processing failed' });
    });

    it('should skip processing when checkout.session.completed has no short_code in metadata', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: {},
            customer_email: 'buyer@example.com'
          }
        }
      };

      req.body = Buffer.from(JSON.stringify(mockEvent));
      req.headers = { 'stripe-signature': 'sig_test' };

      mockConstructWebhookEvent.mockReturnValue(mockEvent);

      await mailController.handleWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith({ received: true });
      // Should not have called any DB queries
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should not send email when recipient has no email', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { short_code: '6774e' },
            customer_email: null
          }
        }
      };

      req.body = Buffer.from(JSON.stringify(mockEvent));
      req.headers = { 'stripe-signature': 'sig_test' };

      mockConstructWebhookEvent.mockReturnValue(mockEvent);
      mockQuery
        .mockResolvedValueOnce({ rows: [] })  // UPDATE payment_status
        .mockResolvedValueOnce({              // SELECT recipient
          rows: [{
            id: 'mail_1',
            recipient_name: 'Test User',
            address: '123 Main St',
            email: null,
            report_url: null
          }]
        });

      await mailController.handleWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith({ received: true });
      expect(mockSendReportPurchasedNotification).not.toHaveBeenCalled();
    });

    it('should handle checkout.session.completed when recipient not found in DB', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { short_code: 'deleted' },
            customer_email: 'buyer@example.com'
          }
        }
      };

      req.body = Buffer.from(JSON.stringify(mockEvent));
      req.headers = { 'stripe-signature': 'sig_test' };

      mockConstructWebhookEvent.mockReturnValue(mockEvent);
      mockQuery
        .mockResolvedValueOnce({ rows: [] })  // UPDATE payment_status
        .mockResolvedValueOnce({ rows: [] }); // SELECT recipient (not found)

      await mailController.handleWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith({ received: true });
      expect(mockSendReportPurchasedNotification).not.toHaveBeenCalled();
    });
  });
});
