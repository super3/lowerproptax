import { jest } from '@jest/globals';

// Mock the database connection
const mockQuery = jest.fn();
jest.unstable_mockModule('../../src/db/connection.js', () => ({
  default: {
    query: mockQuery
  }
}));

// Mock the email service
const mockSendReferralVisitNotification = jest.fn().mockResolvedValue();
jest.unstable_mockModule('../../src/services/emailService.js', () => ({
  sendReferralVisitNotification: mockSendReferralVisitNotification
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
    mockSendReferralVisitNotification.mockClear();
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
      mockXLSXRead.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
      mockSheetToJson.mockReturnValue([]);

      await adminController.uploadMailedProperties(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Spreadsheet is empty' });
    });

    it('should import properties from XLSX', async () => {
      req.file = { buffer: Buffer.from('test') };

      const rows = [
        {
          'Address': '6774 Encore Blvd',
          'City': 'Atlanta',
          'State': 'GA',
          'Zip': '30328',
          'Owner': 'Christopher Porcelli',
          'Sqft': '2016',
          'Tax': '9331.51',
          'Estimated Tax': '7461.30',
          'Homestead': 'false',
          'Parcel': 'ABC123',
          'Comp 1 Address': '6765 Prelude Dr',
          'Comp 1 Sqft': '1900',
          'Comp 1 Tax': '7658.91'
        }
      ];

      mockXLSXRead.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
      mockSheetToJson.mockReturnValue(rows);

      // Mock: check referral code, insert property, insert assessment, insert comp
      mockQuery
        .mockResolvedValueOnce({ rows: [] })         // referral code check
        .mockResolvedValueOnce({ rows: [] })         // insert property
        .mockResolvedValueOnce({ rows: [] })         // insert assessment
        .mockResolvedValueOnce({ rows: [] });        // insert comp

      await adminController.uploadMailedProperties(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        imported: 1,
        skipped: 0
      }));
    });

    it('should skip rows with no address', async () => {
      req.file = { buffer: Buffer.from('test') };
      mockXLSXRead.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
      mockSheetToJson.mockReturnValue([{ 'City': 'Atlanta' }]);

      await adminController.uploadMailedProperties(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        imported: 0,
        skipped: 1,
        errors: expect.arrayContaining([expect.stringContaining('no address')])
      }));
    });

    it('should skip rows with duplicate referral codes', async () => {
      req.file = { buffer: Buffer.from('test') };
      mockXLSXRead.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
      mockSheetToJson.mockReturnValue([{ 'Address': '6774 Encore Blvd' }]);

      // Referral code already exists
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing' }] });

      await adminController.uploadMailedProperties(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        imported: 0,
        skipped: 1,
        errors: expect.arrayContaining([expect.stringContaining('already exists')])
      }));
    });

    it('should handle row-level errors gracefully', async () => {
      req.file = { buffer: Buffer.from('test') };
      mockXLSXRead.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
      mockSheetToJson.mockReturnValue([{ 'Address': '123 Main St' }]);

      // Referral code check passes, but insert fails
      mockQuery
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
      mockXLSXRead.mockImplementation(() => { throw new Error('bad file'); });

      await adminController.uploadMailedProperties(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to process upload' });
    });

    it('should use custom referral code from spreadsheet', async () => {
      req.file = { buffer: Buffer.from('test') };
      mockXLSXRead.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
      mockSheetToJson.mockReturnValue([{ 'Address': '123 Main St', 'Referral Code': 'custom1' }]);

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await adminController.uploadMailedProperties(req, res);

      // Verify the referral code used in the insert
      const insertCall = mockQuery.mock.calls[1];
      expect(insertCall[1]).toContain('custom1');
    });

    it('should import property without tax data (no assessment created)', async () => {
      req.file = { buffer: Buffer.from('test') };
      mockXLSXRead.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
      mockSheetToJson.mockReturnValue([{ 'Address': '999 No Tax St', 'Owner': 'Test' }]);

      mockQuery
        .mockResolvedValueOnce({ rows: [] })  // referral code check
        .mockResolvedValueOnce({ rows: [] }); // insert property (no assessment insert)

      await adminController.uploadMailedProperties(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ imported: 1 }));
      // Only 2 queries: referral check + insert property (no assessment)
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should handle homestead variations (true, Yes, yes)', async () => {
      req.file = { buffer: Buffer.from('test') };
      mockXLSXRead.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
      mockSheetToJson.mockReturnValue([
        { 'Address': '1 A St', 'Homestead': true },
        { 'Address': '2 B St', 'Homestead': 'Yes' },
        { 'Address': '3 C St', 'Homestead': 'yes' },
        { 'Address': '4 D St', 'Homestead': 'true' }
      ]);

      // Each row: referral check + insert property
      for (let i = 0; i < 4; i++) {
        mockQuery
          .mockResolvedValueOnce({ rows: [] })  // referral check
          .mockResolvedValueOnce({ rows: [] }); // insert
      }

      await adminController.uploadMailedProperties(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ imported: 4 }));
    });

    it('should generate fallback referral code for non-standard addresses', async () => {
      req.file = { buffer: Buffer.from('test') };
      mockXLSXRead.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
      mockSheetToJson.mockReturnValue([{ 'Address': 'Unit A Building X' }]);

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await adminController.uploadMailedProperties(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ imported: 1 }));
    });
  });

  describe('getMailedProperties', () => {
    it('should return mailed properties with stats', async () => {
      const mockProperties = [
        { id: 'p1', address: '123 Main St', visit_count: '3', annual_tax: '5000', estimated_annual_tax: '4000' },
        { id: 'p2', address: '456 Elm St', visit_count: '0', annual_tax: '3000', estimated_annual_tax: '3000' }
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

  describe('trackReferralVisit', () => {
    it('should track visit and return property data', async () => {
      req.params.code = '6774e';
      req.headers['x-forwarded-for'] = '192.168.1.1';
      req.headers['user-agent'] = 'Mozilla/5.0';

      const mockProperty = {
        id: 'prop1',
        address: '6774 Encore Blvd',
        city: 'Atlanta',
        state: 'GA',
        zip_code: '30328',
        owner_name: 'Christopher Porcelli',
        sqft: 2016,
        annual_tax: '9331.51',
        estimated_annual_tax: '7461.30',
        comparables: [{ address: '6765 Prelude Dr', sqft: 1900, property_tax: 7658.91 }]
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockProperty] })   // find property
        .mockResolvedValueOnce({ rows: [] })                // insert visit
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }); // count visits

      await adminController.trackReferralVisit(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        address: '6774 Encore Blvd',
        ownerName: 'Christopher Porcelli',
        annualTax: 9331.51,
        estimatedSavings: 1870.21,
        referralCode: '6774e'
      }));

      expect(mockSendReferralVisitNotification).toHaveBeenCalledWith(
        mockProperty,
        expect.objectContaining({
          ip_address: '192.168.1.1',
          visit_count: 5
        })
      );
    });

    it('should return 404 if property not found', async () => {
      req.params.code = 'nonexistent';
      mockQuery.mockResolvedValue({ rows: [] });

      await adminController.trackReferralVisit(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Property not found' });
    });

    it('should handle zero or negative savings', async () => {
      req.params.code = 'test1';

      mockQuery
        .mockResolvedValueOnce({ rows: [{
          id: 'prop1', address: '123 Main St', annual_tax: '3000', estimated_annual_tax: '4000',
          comparables: null
        }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      await adminController.trackReferralVisit(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        estimatedSavings: 0,
        comparables: []
      }));
    });

    it('should handle missing tax data', async () => {
      req.params.code = 'test2';

      mockQuery
        .mockResolvedValueOnce({ rows: [{
          id: 'prop1', address: '123 Main St', annual_tax: null, estimated_annual_tax: null,
          comparables: null
        }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      await adminController.trackReferralVisit(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        annualTax: 0,
        estimatedSavings: 0
      }));
    });

    it('should use socket remoteAddress when x-forwarded-for is not present', async () => {
      req.params.code = 'test3';
      delete req.headers['x-forwarded-for'];

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'prop1', address: '123 Main St', annual_tax: null, estimated_annual_tax: null, comparables: null }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      await adminController.trackReferralVisit(req, res);

      // Check the insert call used remoteAddress
      const insertCall = mockQuery.mock.calls[1];
      expect(insertCall[1][2]).toBe('127.0.0.1');
    });

    it('should use empty string when no IP source available', async () => {
      req.params.code = 'test3b';
      delete req.headers['x-forwarded-for'];
      delete req.socket;

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'prop1', address: '123 Main St', annual_tax: null, estimated_annual_tax: null, comparables: null }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      await adminController.trackReferralVisit(req, res);

      const insertCall = mockQuery.mock.calls[1];
      expect(insertCall[1][2]).toBe('');
    });

    it('should handle database errors', async () => {
      req.params.code = 'test4';
      mockQuery.mockRejectedValue(new Error('Database error'));

      await adminController.trackReferralVisit(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to load property' });
    });

    it('should handle email notification failure gracefully', async () => {
      req.params.code = 'test5';
      mockSendReferralVisitNotification.mockRejectedValue(new Error('email failed'));

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'prop1', address: '123 Main St', annual_tax: null, estimated_annual_tax: null, comparables: null }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      await adminController.trackReferralVisit(req, res);

      // Should still return successfully
      expect(res.json).toHaveBeenCalled();
    });
  });
});
