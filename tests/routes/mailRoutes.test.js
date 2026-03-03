import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// Mock the database connection
const mockQuery = jest.fn();
jest.unstable_mockModule('../../src/db/connection.js', () => ({
  default: {
    query: mockQuery
  }
}));

// Mock the stripe service
jest.unstable_mockModule('../../src/services/stripeService.js', () => ({
  createCheckoutSession: jest.fn().mockResolvedValue({ id: 'cs_test', url: 'https://checkout.stripe.com/test' }),
  constructWebhookEvent: jest.fn()
}));

// Mock the email service
jest.unstable_mockModule('../../src/services/emailService.js', () => ({
  sendReportPurchasedNotification: jest.fn().mockResolvedValue(undefined)
}));

// Import routes after mocking
const mailRoutes = await import('../../src/routes/mailRoutes.js');

describe('Mail Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', mailRoutes.default);
    mockQuery.mockClear();
  });

  describe('GET /api/mail/r/:code', () => {
    it('should return recipient data for valid code', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            id: 'mail_1', shortCode: '6774e', recipientName: 'Test',
            address: '123 Main', paymentStatus: 'unpaid', reportUrl: null,
            campaignName: 'Test', county: 'Fulton', deadline: null,
            city: null, state: null, zipCode: null, sqft: null,
            annualTax: null, estimatedSavings: null, comparables: null
          }]
        })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/mail/r/6774e');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({ shortCode: '6774e' }));
    });

    it('should return 404 for invalid code', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const response = await request(app).get('/api/mail/r/invalid');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/mail/r/:code/checkout', () => {
    it('should create checkout session for unpaid recipient', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'mail_1', short_code: '6774e', recipient_name: 'Test', address: '123 Main', payment_status: 'unpaid' }]
        })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/mail/r/6774e/checkout')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({ checkoutUrl: expect.any(String) }));
    });
  });
});
