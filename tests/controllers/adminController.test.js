import { jest } from '@jest/globals';

// Mock the database connection
const mockQuery = jest.fn();
jest.unstable_mockModule('../../src/db/connection.js', () => ({
  default: {
    query: mockQuery
  }
}));

// Mock xlsx
const mockXLSXRead = jest.fn();
const mockSheetToJson = jest.fn();
jest.unstable_mockModule('xlsx', () => ({
  read: mockXLSXRead,
  utils: { sheet_to_json: mockSheetToJson }
}));

// Import the controller after mocking
const adminController = await import('../../src/controllers/adminController.js');

describe('Admin Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { id: 'admin123' },
      params: {},
      body: {},
      headers: {},
      socket: { remoteAddress: '127.0.0.1' }
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    mockQuery.mockClear();
    mockXLSXRead.mockClear();
    mockSheetToJson.mockClear();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getPendingProperties', () => {
    it('should return all pending properties', async () => {
      const mockProperties = [
        { id: 'prop1', address: '123 Main St', status: 'preparing', created_at: new Date(), user_id: 'user1' },
        { id: 'prop2', address: '456 Elm St', status: 'preparing', created_at: new Date(), user_id: 'user2' }
      ];

      mockQuery.mockResolvedValue({ rows: mockProperties });
      await adminController.getPendingProperties(req, res);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("WHERE a.status = 'preparing' OR a.status IS NULL"));
      expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ id: 'prop1', status: 'preparing' })
      ]));
    });

    it('should return empty array when no pending properties exist', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      await adminController.getPendingProperties(req, res);
      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('should handle null status and set it to preparing', async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: 'prop1', status: null }] });
      await adminController.getPendingProperties(req, res);
      expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ status: 'preparing' })]);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));
      await adminController.getPendingProperties(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch pending properties' });
    });
  });

  describe('getCompletedProperties', () => {
    it('should return all completed properties', async () => {
      const mockProperties = [{ id: 'prop3', status: 'ready' }];
      mockQuery.mockResolvedValue({ rows: mockProperties });
      await adminController.getCompletedProperties(req, res);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("WHERE a.status IN ('ready', 'invalid')"));
      expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'prop3' })]));
    });

    it('should return empty array when no completed properties exist', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      await adminController.getCompletedProperties(req, res);
      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));
      await adminController.getCompletedProperties(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch completed properties' });
    });
  });

  describe('getPropertyDetails', () => {
    it('should return property details by ID', async () => {
      req.params.id = 'prop1';
      const mockProperty = { id: 'prop1', address: '123 Main St', userId: 'user1' };
      const mockAssessments = [{ id: 'assess_prop1_2025', year: 2025, annualTax: 5000, status: 'preparing' }];

      mockQuery
        .mockResolvedValueOnce({ rows: [mockProperty] })
        .mockResolvedValueOnce({ rows: mockAssessments });

      await adminController.getPropertyDetails(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        ...mockProperty,
        assessments: mockAssessments,
        currentAssessment: expect.objectContaining({ year: 2025, annualTax: 5000 })
      }));
    });

    it('should handle property with no assessments', async () => {
      req.params.id = 'prop1';
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'prop1', address: '123 Main St' }] })
        .mockResolvedValueOnce({ rows: [] });

      await adminController.getPropertyDetails(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        currentAssessment: expect.objectContaining({ year: 2025, annualTax: null, status: 'preparing' })
      }));
    });

    it('should return 404 if property does not exist', async () => {
      req.params.id = 'nonexistent';
      mockQuery.mockResolvedValue({ rows: [] });
      await adminController.getPropertyDetails(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Property not found' });
    });

    it('should handle database errors', async () => {
      req.params.id = 'prop1';
      mockQuery.mockRejectedValue(new Error('Database error'));
      await adminController.getPropertyDetails(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should fetch user email from Clerk when CLERK_SECRET_KEY is set', async () => {
      const originalEnv = process.env.CLERK_SECRET_KEY;
      process.env.CLERK_SECRET_KEY = 'test_clerk_key';
      req.params.id = 'prop1';

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'prop1', userId: 'user123' }] })
        .mockResolvedValueOnce({ rows: [] });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ email_addresses: [{ email_address: 'user@example.com' }] })
      });

      await adminController.getPropertyDetails(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ userEmail: 'user@example.com' }));

      process.env.CLERK_SECRET_KEY = originalEnv;
      delete global.fetch;
    });

    it('should handle Clerk API failure gracefully', async () => {
      const originalEnv = process.env.CLERK_SECRET_KEY;
      process.env.CLERK_SECRET_KEY = 'test_clerk_key';
      req.params.id = 'prop1';

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'prop1', userId: 'user123' }] })
        .mockResolvedValueOnce({ rows: [] });

      global.fetch = jest.fn().mockResolvedValue({ ok: false });
      await adminController.getPropertyDetails(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ userEmail: null }));

      process.env.CLERK_SECRET_KEY = originalEnv;
      delete global.fetch;
    });

    it('should handle Clerk API errors gracefully', async () => {
      const originalEnv = process.env.CLERK_SECRET_KEY;
      process.env.CLERK_SECRET_KEY = 'test_clerk_key';
      req.params.id = 'prop1';

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'prop1', userId: 'user123' }] })
        .mockResolvedValueOnce({ rows: [] });

      global.fetch = jest.fn().mockRejectedValue(new Error('Clerk API error'));
      await adminController.getPropertyDetails(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ userEmail: null }));

      process.env.CLERK_SECRET_KEY = originalEnv;
      delete global.fetch;
    });

    it('should handle missing email_addresses in Clerk response', async () => {
      const originalEnv = process.env.CLERK_SECRET_KEY;
      process.env.CLERK_SECRET_KEY = 'test_clerk_key';
      req.params.id = 'prop1';

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'prop1', userId: 'user123' }] })
        .mockResolvedValueOnce({ rows: [] });

      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
      await adminController.getPropertyDetails(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ userEmail: null }));

      process.env.CLERK_SECRET_KEY = originalEnv;
      delete global.fetch;
    });
  });

  describe('updatePropertyDetails', () => {
    it('should update property details', async () => {
      req.params.id = 'prop1';
      req.body = { bedrooms: 4, bathrooms: 3.5, sqft: 2000, annualTax: 6000 };

      const mockUpdatedProperty = { id: 'prop1', bedrooms: 4, updated_at: new Date() };
      const mockAssessment = { id: 'assess_prop1_2025', year: 2025, annualTax: 6000 };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUpdatedProperty] })
        .mockResolvedValueOnce({ rows: [{ year: 2025 }] })
        .mockResolvedValueOnce({ rows: [mockAssessment] });

      await adminController.updatePropertyDetails(req, res);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE properties'), expect.any(Array));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ currentAssessment: mockAssessment }));
    });

    it('should use provided year when explicitly specified', async () => {
      req.params.id = 'prop1';
      req.body = { year: 2024, annualTax: 2500 };

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'prop1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'assess_prop1_2024', year: 2024 }] });

      await adminController.updatePropertyDetails(req, res);
      expect(res.json).toHaveBeenCalled();
    });

    it('should use default year when property has no existing assessments', async () => {
      req.params.id = 'prop1';
      req.body = { bedrooms: 3 };

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'prop1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ year: 2025 }] });

      await adminController.updatePropertyDetails(req, res);
      expect(res.json).toHaveBeenCalled();
    });

    it('should return 404 if property does not exist', async () => {
      req.params.id = 'nonexistent';
      req.body = { bedrooms: 3 };
      mockQuery.mockResolvedValue({ rows: [] });

      await adminController.updatePropertyDetails(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should handle database errors', async () => {
      req.params.id = 'prop1';
      req.body = { bedrooms: 3 };
      mockQuery.mockRejectedValue(new Error('Database error'));

      await adminController.updatePropertyDetails(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should handle undefined values correctly', async () => {
      req.params.id = 'prop1';
      req.body = {};

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'prop1' }] })
        .mockResolvedValueOnce({ rows: [{ year: 2025 }] })
        .mockResolvedValueOnce({ rows: [{ year: 2025 }] });

      await adminController.updatePropertyDetails(req, res);
      expect(res.json).toHaveBeenCalled();
    });

    it('should pass all defined fields including homestead, qpublicUrl, parcelNumber, taxRecordUrl, estimatedAnnualTax, reportUrl, status', async () => {
      req.params.id = 'prop1';
      req.body = {
        bedrooms: 4,
        bathrooms: 3.5,
        sqft: 2000,
        homestead: true,
        qpublicUrl: 'https://qpublic.example.com',
        parcelNumber: 'ABC123',
        taxRecordUrl: 'https://tax.example.com',
        annualTax: 6000,
        estimatedAnnualTax: 4000,
        reportUrl: 'https://report.example.com',
        status: 'ready'
      };

      const mockUpdatedProperty = { id: 'prop1', updated_at: new Date() };
      const mockAssessment = { id: 'assess_prop1_2025', year: 2025 };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUpdatedProperty] })
        .mockResolvedValueOnce({ rows: [{ year: 2025 }] })
        .mockResolvedValueOnce({ rows: [mockAssessment] });

      await adminController.updatePropertyDetails(req, res);

      // Verify property update includes all fields
      const propertyCall = mockQuery.mock.calls[0];
      expect(propertyCall[1]).toEqual([4, 3.5, 2000, true, 'https://qpublic.example.com', 'ABC123', 'https://tax.example.com', 'prop1']);

      // Verify assessment includes all fields
      const assessmentCall = mockQuery.mock.calls[2];
      expect(assessmentCall[1]).toContain(6000);
      expect(assessmentCall[1]).toContain(4000);
      expect(assessmentCall[1]).toContain('https://report.example.com');
      expect(assessmentCall[1]).toContain('ready');
    });
  });

  describe('uploadMailedProperties', () => {
    it('should return 400 if no file uploaded', async () => {
      await adminController.uploadMailedProperties(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'No file uploaded' });
    });

    it('should return 400 if spreadsheet is empty', async () => {
      req.file = { buffer: Buffer.from('test') };
      req.body = {};
      mockXLSXRead.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
      mockSheetToJson.mockReturnValue([]);

      await adminController.uploadMailedProperties(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Spreadsheet is empty' });
    });

    it('should import properties from XLSX into a campaign', async () => {
      req.file = { buffer: Buffer.from('test') };
      req.body = { campaignName: 'Test Campaign' };

      const rows = [
        {
          'Address': '6774 Encore Blvd',
          'City': 'Atlanta',
          'State': 'GA',
          'Zip': '30328',
          'Owner': 'Christopher Porcelli',
          'Sqft': '2016',
          'Tax': '9331.51',
          'Estimated Savings': '1870.21',
          'Comp 1 Address': '6765 Prelude Dr',
          'Comp 1 Sqft': '1900',
          'Comp 1 Tax': '7658.91'
        }
      ];

      mockXLSXRead.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
      mockSheetToJson.mockReturnValue(rows);

      // Mock: create campaign, check short code, insert recipient
      mockQuery
        .mockResolvedValueOnce({ rows: [] })         // create campaign
        .mockResolvedValueOnce({ rows: [] })         // short code check
        .mockResolvedValueOnce({ rows: [] });        // insert recipient

      await adminController.uploadMailedProperties(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        imported: 1,
        skipped: 0,
        campaignId: expect.stringContaining('camp_')
      }));
    });

    it('should skip rows with no address', async () => {
      req.file = { buffer: Buffer.from('test') };
      req.body = {};
      mockXLSXRead.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
      mockSheetToJson.mockReturnValue([{ 'City': 'Atlanta' }]);

      // create campaign
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await adminController.uploadMailedProperties(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        imported: 0,
        skipped: 1,
        errors: expect.arrayContaining([expect.stringContaining('no address')])
      }));
    });

    it('should skip rows with duplicate short codes', async () => {
      req.file = { buffer: Buffer.from('test') };
      req.body = {};
      mockXLSXRead.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
      mockSheetToJson.mockReturnValue([{ 'Address': '6774 Encore Blvd' }]);

      // create campaign, then short code already exists
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'existing' }] });

      await adminController.uploadMailedProperties(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        imported: 0,
        skipped: 1,
        errors: expect.arrayContaining([expect.stringContaining('already exists')])
      }));
    });

    it('should handle row-level errors gracefully', async () => {
      req.file = { buffer: Buffer.from('test') };
      req.body = {};
      mockXLSXRead.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
      mockSheetToJson.mockReturnValue([{ 'Address': '123 Main St' }]);

      // create campaign, short code check passes, insert fails
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce(new Error('insert failed'));

      await adminController.uploadMailedProperties(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        imported: 0,
        skipped: 1,
        errors: expect.arrayContaining([expect.stringContaining('insert failed')])
      }));
    });

    it('should handle top-level errors', async () => {
      req.file = { buffer: Buffer.from('test') };
      req.body = {};
      mockXLSXRead.mockImplementation(() => { throw new Error('bad file'); });

      await adminController.uploadMailedProperties(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to process upload' });
    });

    it('should use custom short code from spreadsheet', async () => {
      req.file = { buffer: Buffer.from('test') };
      req.body = {};
      mockXLSXRead.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
      mockSheetToJson.mockReturnValue([{ 'Address': '123 Main St', 'Short Code': 'custom1' }]);

      // create campaign, short code check, insert
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await adminController.uploadMailedProperties(req, res);

      // Verify the short code used in the insert (3rd call, 3rd param)
      const insertCall = mockQuery.mock.calls[2];
      expect(insertCall[1]).toContain('custom1');
    });

    it('should import property without comparables', async () => {
      req.file = { buffer: Buffer.from('test') };
      req.body = {};
      mockXLSXRead.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
      mockSheetToJson.mockReturnValue([{ 'Address': '999 No Comp St', 'Owner': 'Test' }]);

      // create campaign, short code check, insert recipient
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await adminController.uploadMailedProperties(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ imported: 1 }));
    });

    it('should use default campaign name when not provided', async () => {
      req.file = { buffer: Buffer.from('test') };
      req.body = {};
      mockXLSXRead.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
      mockSheetToJson.mockReturnValue([{ 'Address': '100 Test St' }]);

      // create campaign, short code check, insert
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await adminController.uploadMailedProperties(req, res);

      // Verify campaign was created with default name
      const createCampaignCall = mockQuery.mock.calls[0];
      expect(createCampaignCall[1][1]).toContain('Upload');
    });

    it('should use Referral Code column as fallback for Short Code', async () => {
      req.file = { buffer: Buffer.from('test') };
      req.body = {};
      mockXLSXRead.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
      mockSheetToJson.mockReturnValue([{ 'Address': '123 Main St', 'Referral Code': 'ref1' }]);

      // create campaign, short code check, insert
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await adminController.uploadMailedProperties(req, res);

      const insertCall = mockQuery.mock.calls[2];
      expect(insertCall[1]).toContain('ref1');
    });

    it('should generate short code from address with non-standard format', async () => {
      req.file = { buffer: Buffer.from('test') };
      req.body = {};
      mockXLSXRead.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
      mockSheetToJson.mockReturnValue([{ 'Address': 'Unit A Building X' }]);

      // create campaign, short code check, insert
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await adminController.uploadMailedProperties(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ imported: 1 }));
    });

    it('should generate short code from single-word address', async () => {
      req.file = { buffer: Buffer.from('test') };
      req.body = {};
      mockXLSXRead.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
      mockSheetToJson.mockReturnValue([{ 'Address': 'Warehouse' }]);

      // create campaign, short code check, insert
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await adminController.uploadMailedProperties(req, res);

      // Short code should be "Warehouse" with no street char
      const insertCall = mockQuery.mock.calls[2];
      expect(insertCall[1][2]).toBe('Warehouse');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ imported: 1 }));
    });
  });

  describe('getMailedProperties', () => {
    it('should return mailed properties with stats', async () => {
      const mockProperties = [
        { id: 'p1', address: '123 Main St', page_views: '3', annual_tax: '5000' },
        { id: 'p2', address: '456 Elm St', page_views: '0', annual_tax: '3000' }
      ];

      mockQuery.mockResolvedValue({ rows: mockProperties });

      await adminController.getMailedProperties(req, res);

      expect(res.json).toHaveBeenCalledWith({
        properties: mockProperties,
        stats: {
          totalMailed: 2,
          totalVisited: 1,
          visitRate: '50.0'
        }
      });
    });

    it('should return empty results with zero stats', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await adminController.getMailedProperties(req, res);

      expect(res.json).toHaveBeenCalledWith({
        properties: [],
        stats: { totalMailed: 0, totalVisited: 0, visitRate: '0.0' }
      });
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await adminController.getMailedProperties(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch mailed properties' });
    });
  });
});
