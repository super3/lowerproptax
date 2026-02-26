import { jest } from '@jest/globals';

// Mock the database connection
const mockQuery = jest.fn();
jest.unstable_mockModule('../../src/db/connection.js', () => ({
  default: {
    query: mockQuery
  }
}));

// Import after mocking
const campaignController = await import('../../src/controllers/campaignController.js');

describe('Campaign Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { id: 'admin123' },
      params: {},
      body: {}
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    mockQuery.mockClear();
  });

  describe('getCampaigns', () => {
    it('should return all campaigns with stats', async () => {
      const mockCampaigns = [
        {
          id: 'camp_1',
          name: 'Aria Feb 2026',
          county: 'Fulton',
          state: 'GA',
          deadline: '2026-04-01',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recipientCount: '5',
          paidCount: '2',
          totalViews: '15'
        }
      ];

      mockQuery.mockResolvedValue({ rows: mockCampaigns });

      await campaignController.getCampaigns(req, res);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('FROM campaigns'));
      expect(res.json).toHaveBeenCalledWith(mockCampaigns);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await campaignController.getCampaigns(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch campaigns' });
    });
  });

  describe('createCampaign', () => {
    it('should create a new campaign', async () => {
      req.body = {
        name: 'Aria Feb 2026',
        county: 'Fulton',
        state: 'GA',
        deadline: '2026-04-01'
      };

      const mockCampaign = {
        id: 'camp_1',
        name: 'Aria Feb 2026',
        county: 'Fulton',
        state: 'GA',
        deadline: '2026-04-01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockQuery.mockResolvedValue({ rows: [mockCampaign] });

      await campaignController.createCampaign(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockCampaign);
    });

    it('should return 400 if name is missing', async () => {
      req.body = { county: 'Fulton' };

      await campaignController.createCampaign(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Campaign name is required' });
    });

    it('should handle database errors', async () => {
      req.body = { name: 'Test Campaign' };
      mockQuery.mockRejectedValue(new Error('Database error'));

      await campaignController.createCampaign(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to create campaign' });
    });
  });

  describe('getCampaignDetails', () => {
    it('should return campaign with recipients', async () => {
      req.params.id = 'camp_1';

      const mockCampaign = {
        id: 'camp_1',
        name: 'Aria Feb 2026',
        county: 'Fulton',
        state: 'GA',
        deadline: '2026-04-01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const mockRecipients = [
        {
          id: 'mail_1',
          shortCode: '6774e',
          recipientName: 'Test User',
          address: '6774 Encore Blvd',
          paymentStatus: 'unpaid',
          pageViews: 3,
          createdAt: new Date().toISOString()
        }
      ];

      mockQuery
        .mockResolvedValueOnce({ rows: [mockCampaign] })
        .mockResolvedValueOnce({ rows: mockRecipients });

      await campaignController.getCampaignDetails(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'camp_1',
          name: 'Aria Feb 2026',
          recipients: mockRecipients
        })
      );
    });

    it('should return 404 for nonexistent campaign', async () => {
      req.params.id = 'nonexistent';
      mockQuery.mockResolvedValue({ rows: [] });

      await campaignController.getCampaignDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Campaign not found' });
    });

    it('should handle database errors', async () => {
      req.params.id = 'camp_1';
      mockQuery.mockRejectedValue(new Error('Database error'));

      await campaignController.getCampaignDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch campaign details' });
    });
  });

  describe('addRecipient', () => {
    it('should add a recipient to a campaign', async () => {
      req.params.id = 'camp_1';
      req.body = {
        recipientName: 'Christopher & Heather Porcelli',
        address: '6774 Encore Blvd',
        city: 'Atlanta',
        zipCode: '30328',
        sqft: 2016,
        annualTax: 9331.51,
        estimatedSavings: 1870.21,
        comparables: [{ address: '6765 Prelude Dr', sqft: 1900, annualTax: 7658.91 }]
      };

      const mockRecipient = {
        id: 'mail_1',
        shortCode: '6774e',
        recipientName: 'Christopher & Heather Porcelli',
        address: '6774 Encore Blvd',
        paymentStatus: 'unpaid',
        createdAt: new Date().toISOString()
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'camp_1' }] })  // campaign exists check
        .mockResolvedValueOnce({ rows: [mockRecipient] });      // INSERT recipient

      await campaignController.addRecipient(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockRecipient);
    });

    it('should return 400 if name or address is missing', async () => {
      req.params.id = 'camp_1';
      req.body = { recipientName: 'Test' };

      await campaignController.addRecipient(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Recipient name and address are required' });
    });

    it('should return 404 if campaign does not exist', async () => {
      req.params.id = 'nonexistent';
      req.body = { recipientName: 'Test', address: '123 Main St' };

      mockQuery.mockResolvedValue({ rows: [] });

      await campaignController.addRecipient(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Campaign not found' });
    });

    it('should return 409 for duplicate short code', async () => {
      req.params.id = 'camp_1';
      req.body = { recipientName: 'Test', address: '6774 Encore Blvd', shortCode: '6774e' };

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'camp_1' }] })
        .mockRejectedValueOnce({ code: '23505', constraint: 'mail_recipients_short_code_key' });

      await campaignController.addRecipient(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Short code already exists') })
      );
    });

    it('should handle database errors', async () => {
      req.params.id = 'camp_1';
      req.body = { recipientName: 'Test', address: '123 Main St' };

      mockQuery.mockRejectedValue(new Error('Database error'));

      await campaignController.addRecipient(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to add recipient' });
    });
  });

  describe('updateRecipient', () => {
    it('should update a recipient', async () => {
      req.params.recipientId = 'mail_1';
      req.body = { estimatedSavings: 2000.00 };

      const mockUpdated = {
        id: 'mail_1',
        shortCode: '6774e',
        recipientName: 'Test',
        estimatedSavings: '2000.00',
        paymentStatus: 'unpaid',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockQuery.mockResolvedValue({ rows: [mockUpdated] });

      await campaignController.updateRecipient(req, res);

      expect(res.json).toHaveBeenCalledWith(mockUpdated);
    });

    it('should return 404 for nonexistent recipient', async () => {
      req.params.recipientId = 'nonexistent';
      req.body = { estimatedSavings: 2000 };

      mockQuery.mockResolvedValue({ rows: [] });

      await campaignController.updateRecipient(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Recipient not found' });
    });

    it('should handle database errors', async () => {
      req.params.recipientId = 'mail_1';
      req.body = {};

      mockQuery.mockRejectedValue(new Error('Database error'));

      await campaignController.updateRecipient(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to update recipient' });
    });
  });

  describe('deleteRecipient', () => {
    it('should delete a recipient', async () => {
      req.params.recipientId = 'mail_1';

      mockQuery.mockResolvedValue({ rows: [{ id: 'mail_1' }] });

      await campaignController.deleteRecipient(req, res);

      expect(res.json).toHaveBeenCalledWith({ message: 'Recipient deleted successfully' });
    });

    it('should return 404 for nonexistent recipient', async () => {
      req.params.recipientId = 'nonexistent';

      mockQuery.mockResolvedValue({ rows: [] });

      await campaignController.deleteRecipient(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Recipient not found' });
    });

    it('should handle database errors', async () => {
      req.params.recipientId = 'mail_1';

      mockQuery.mockRejectedValue(new Error('Database error'));

      await campaignController.deleteRecipient(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to delete recipient' });
    });
  });
});
