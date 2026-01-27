import { jest } from '@jest/globals';

// Mock the database connection
const mockQuery = jest.fn();
jest.unstable_mockModule('../../src/db/connection.js', () => ({
  default: {
    query: mockQuery
  }
}));

// Mock the email service
const mockSendAssessmentReadyNotification = jest.fn();
jest.unstable_mockModule('../../src/services/emailService.js', () => ({
  sendAssessmentReadyNotification: mockSendAssessmentReadyNotification
}));

// Mock the address parser
const mockParseAddressForScraping = jest.fn();
jest.unstable_mockModule('../../scripts/address-parser.js', () => ({
  parseAddressForScraping: mockParseAddressForScraping
}));

// Mock the county scraper
const mockScrapeProperty = jest.fn();
jest.unstable_mockModule('../../scripts/county-scraper.js', () => ({
  scrapeProperty: mockScrapeProperty
}));

// Import the controller after mocking
const adminController = await import('../../src/controllers/adminController.js');

describe('Admin Controller', () => {
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
    mockSendAssessmentReadyNotification.mockClear();
    mockParseAddressForScraping.mockClear();
    mockScrapeProperty.mockClear();
  });

  describe('getPendingProperties', () => {
    it('should return all pending properties', async () => {
      const mockProperties = [
        {
          id: 'prop1',
          address: '123 Main St',
          city: 'Atlanta',
          state: 'GA',
          zip_code: '30301',
          status: 'preparing',
          created_at: new Date(),
          user_id: 'user1'
        },
        {
          id: 'prop2',
          address: '456 Elm St',
          city: 'Boston',
          state: 'MA',
          zip_code: '02101',
          status: 'preparing',
          created_at: new Date(),
          user_id: 'user2'
        }
      ];

      mockQuery.mockResolvedValue({ rows: mockProperties });

      await adminController.getPendingProperties(req, res);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("WHERE a.status = 'preparing' OR a.status IS NULL"));
      expect(res.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'prop1',
            status: 'preparing'
          }),
          expect.objectContaining({
            id: 'prop2',
            status: 'preparing'
          })
        ])
      );
    });

    it('should return empty array when no pending properties exist', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await adminController.getPendingProperties(req, res);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('should handle null status and set it to preparing', async () => {
      const mockProperties = [
        {
          id: 'prop1',
          address: '123 Main St',
          city: 'Atlanta',
          state: 'GA',
          zip_code: '30301',
          status: null, // null status should become 'preparing'
          created_at: new Date(),
          user_id: 'user1'
        }
      ];

      mockQuery.mockResolvedValue({ rows: mockProperties });

      await adminController.getPendingProperties(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'prop1',
            status: 'preparing'
          })
        ])
      );
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
      const mockProperties = [
        {
          id: 'prop3',
          address: '789 Oak Ave',
          city: 'Chicago',
          state: 'IL',
          zip_code: '60601',
          status: 'ready',
          created_at: new Date(),
          updated_at: new Date(),
          user_id: 'user3'
        }
      ];

      mockQuery.mockResolvedValue({ rows: mockProperties });

      await adminController.getCompletedProperties(req, res);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("WHERE a.status IN ('ready', 'invalid')"));
      expect(res.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'prop3',
            status: 'ready'
          })
        ])
      );
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
      const mockProperty = {
        id: 'prop1',
        address: '123 Main St',
        city: 'Atlanta',
        state: 'GA',
        zip_code: '30301',
        bedrooms: 3,
        bathrooms: 2.5,
        sqft: 1500,
        created_at: new Date(),
        user_id: 'user1'
      };

      // Use a fixed year (2025) to test that we use the latest assessment, not current year
      const mockAssessments = [
        {
          id: 'assess_prop1_2025',
          year: 2025,
          annualTax: 5000,
          status: 'preparing',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockQuery
        .mockResolvedValueOnce({ rows: [mockProperty] })
        .mockResolvedValueOnce({ rows: mockAssessments });

      await adminController.getPropertyDetails(req, res);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['prop1']
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockProperty,
          assessments: mockAssessments,
          currentAssessment: expect.objectContaining({
            year: 2025,
            annualTax: 5000
          })
        })
      );
    });

    it('should handle property with no assessments', async () => {
      req.params.id = 'prop1';
      const mockProperty = {
        id: 'prop1',
        address: '123 Main St',
        city: 'Atlanta',
        state: 'GA',
        zip_code: '30301',
        bedrooms: 3,
        bathrooms: 2.5,
        sqft: 1500,
        created_at: new Date(),
        user_id: 'user1'
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockProperty] })
        .mockResolvedValueOnce({ rows: [] }); // No assessments

      await adminController.getPropertyDetails(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockProperty,
          assessments: [],
          currentAssessment: expect.objectContaining({
            year: 2025, // Default year since 2026 bills aren't out yet
            annualTax: null,
            status: 'preparing'
          })
        })
      );
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
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch property details' });
    });

    it('should fetch user email from Clerk when CLERK_SECRET_KEY is set', async () => {
      const originalEnv = process.env.CLERK_SECRET_KEY;
      process.env.CLERK_SECRET_KEY = 'test_clerk_key';

      req.params.id = 'prop1';
      const mockProperty = {
        id: 'prop1',
        address: '123 Main St',
        userId: 'user123',
        city: 'Atlanta',
        state: 'GA'
      };

      const mockAssessments = [];

      mockQuery
        .mockResolvedValueOnce({ rows: [mockProperty] })
        .mockResolvedValueOnce({ rows: mockAssessments });

      // Mock fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          email_addresses: [{ email_address: 'user@example.com' }]
        })
      });

      await adminController.getPropertyDetails(req, res);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.clerk.com/v1/users/user123',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer test_clerk_key'
          }
        })
      );

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          userEmail: 'user@example.com'
        })
      );

      process.env.CLERK_SECRET_KEY = originalEnv;
      delete global.fetch;
    });

    it('should handle Clerk API failure gracefully', async () => {
      const originalEnv = process.env.CLERK_SECRET_KEY;
      process.env.CLERK_SECRET_KEY = 'test_clerk_key';

      req.params.id = 'prop1';
      const mockProperty = {
        id: 'prop1',
        address: '123 Main St',
        userId: 'user123'
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockProperty] })
        .mockResolvedValueOnce({ rows: [] });

      // Mock fetch to return non-ok response
      global.fetch = jest.fn().mockResolvedValue({
        ok: false
      });

      await adminController.getPropertyDetails(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          userEmail: null
        })
      );

      process.env.CLERK_SECRET_KEY = originalEnv;
      delete global.fetch;
    });

    it('should handle Clerk API errors gracefully', async () => {
      const originalEnv = process.env.CLERK_SECRET_KEY;
      process.env.CLERK_SECRET_KEY = 'test_clerk_key';

      req.params.id = 'prop1';
      const mockProperty = {
        id: 'prop1',
        address: '123 Main St',
        userId: 'user123'
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockProperty] })
        .mockResolvedValueOnce({ rows: [] });

      // Mock fetch to throw error
      global.fetch = jest.fn().mockRejectedValue(new Error('Clerk API error'));

      await adminController.getPropertyDetails(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          userEmail: null
        })
      );

      process.env.CLERK_SECRET_KEY = originalEnv;
      delete global.fetch;
    });

    it('should handle missing email_addresses in Clerk response', async () => {
      const originalEnv = process.env.CLERK_SECRET_KEY;
      process.env.CLERK_SECRET_KEY = 'test_clerk_key';

      req.params.id = 'prop1';
      const mockProperty = {
        id: 'prop1',
        address: '123 Main St',
        userId: 'user123'
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockProperty] })
        .mockResolvedValueOnce({ rows: [] });

      // Mock fetch with no email_addresses
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({})
      });

      await adminController.getPropertyDetails(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          userEmail: null
        })
      );

      process.env.CLERK_SECRET_KEY = originalEnv;
      delete global.fetch;
    });
  });

  describe('updatePropertyDetails', () => {
    it('should update property details', async () => {
      req.params.id = 'prop1';
      req.body = {
        bedrooms: 4,
        bathrooms: 3.5,
        sqft: 2000,
        annualTax: 6000
      };

      const mockUpdatedProperty = {
        id: 'prop1',
        bedrooms: 4,
        bathrooms: 3.5,
        sqft: 2000,
        updated_at: new Date()
      };

      const mockAssessment = {
        id: 'assess_prop1_2025',
        property_id: 'prop1',
        year: 2025,
        annualTax: 6000,
        status: null,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUpdatedProperty] })  // UPDATE properties
        .mockResolvedValueOnce({ rows: [{ year: 2025 }] })       // SELECT latest year
        .mockResolvedValueOnce({ rows: [mockAssessment] });      // INSERT/UPDATE assessment

      await adminController.updatePropertyDetails(req, res);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE properties'),
        expect.arrayContaining([4, 3.5, 2000, 'prop1'])
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockUpdatedProperty,
          currentAssessment: mockAssessment
        })
      );
    });

    it('should handle partial updates', async () => {
      req.params.id = 'prop1';
      req.body = {
        bedrooms: 3
      };

      const mockUpdatedProperty = {
        id: 'prop1',
        bedrooms: 3,
        updated_at: new Date()
      };

      const mockAssessment = {
        id: 'assess_prop1_2025',
        property_id: 'prop1',
        year: 2025,
        annualTax: null,
        status: null,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUpdatedProperty] })  // UPDATE properties
        .mockResolvedValueOnce({ rows: [{ year: 2025 }] })       // SELECT latest year
        .mockResolvedValueOnce({ rows: [mockAssessment] });      // INSERT/UPDATE assessment

      await adminController.updatePropertyDetails(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockUpdatedProperty,
          currentAssessment: mockAssessment
        })
      );
    });

    it('should use provided year when explicitly specified', async () => {
      req.params.id = 'prop1';
      req.body = {
        year: 2024,  // Explicitly provide a year
        annualTax: 2500
      };

      const mockUpdatedProperty = {
        id: 'prop1',
        updated_at: new Date()
      };

      const mockAssessment = {
        id: 'assess_prop1_2024',
        property_id: 'prop1',
        year: 2024,
        annualTax: 2500,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUpdatedProperty] })  // UPDATE properties
        // No SELECT latest year query - year was provided
        .mockResolvedValueOnce({ rows: [mockAssessment] });      // INSERT/UPDATE assessment

      await adminController.updatePropertyDetails(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockUpdatedProperty,
          currentAssessment: mockAssessment
        })
      );
    });

    it('should use current year when property has no existing assessments', async () => {
      req.params.id = 'prop1';
      req.body = {
        bedrooms: 3,
        annualTax: 2000
      };

      const mockUpdatedProperty = {
        id: 'prop1',
        bedrooms: 3,
        updated_at: new Date()
      };

      const defaultYear = 2025; // Default year since 2026 bills aren't out yet
      const mockAssessment = {
        id: `assess_prop1_${defaultYear}`,
        property_id: 'prop1',
        year: defaultYear,
        annualTax: 2000,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUpdatedProperty] })  // UPDATE properties
        .mockResolvedValueOnce({ rows: [] })                     // SELECT latest year (no existing assessments)
        .mockResolvedValueOnce({ rows: [mockAssessment] });      // INSERT/UPDATE assessment

      await adminController.updatePropertyDetails(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockUpdatedProperty,
          currentAssessment: mockAssessment
        })
      );
    });

    it('should return 404 if property does not exist', async () => {
      req.params.id = 'nonexistent';
      req.body = { bedrooms: 3 };
      mockQuery.mockResolvedValue({ rows: [] });

      await adminController.updatePropertyDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Property not found' });
    });

    it('should handle database errors', async () => {
      req.params.id = 'prop1';
      req.body = { bedrooms: 3 };
      mockQuery.mockRejectedValue(new Error('Database error'));

      await adminController.updatePropertyDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to update property details' });
    });

    it('should handle undefined values correctly', async () => {
      req.params.id = 'prop1';
      req.body = {
        bedrooms: undefined,
        bathrooms: undefined,
        sqft: undefined,
        annualTax: undefined,
        estimatedAnnualTax: undefined,
        reportUrl: undefined,
        status: undefined
      };

      const mockUpdatedProperty = {
        id: 'prop1',
        updated_at: new Date()
      };

      const mockAssessment = {
        id: 'assess_prop1_2025',
        property_id: 'prop1',
        year: 2025,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUpdatedProperty] })  // UPDATE properties
        .mockResolvedValueOnce({ rows: [{ year: 2025 }] })       // SELECT latest year
        .mockResolvedValueOnce({ rows: [mockAssessment] });      // INSERT/UPDATE assessment

      await adminController.updatePropertyDetails(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockUpdatedProperty,
          currentAssessment: mockAssessment
        })
      );
    });

    it('should handle mix of defined and undefined assessment values', async () => {
      req.params.id = 'prop1';
      req.body = {
        annualTax: 6000,
        estimatedAnnualTax: undefined,
        reportUrl: 'https://example.com/report.pdf',
        status: 'ready'
      };

      const mockUpdatedProperty = {
        id: 'prop1',
        updated_at: new Date()
      };

      const mockAssessment = {
        id: 'assess_prop1_2025',
        property_id: 'prop1',
        year: 2025,
        annualTax: 6000,
        estimatedAnnualTax: null,
        reportUrl: 'https://example.com/report.pdf',
        status: 'ready',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUpdatedProperty] })  // UPDATE properties
        .mockResolvedValueOnce({ rows: [{ year: 2025 }] })       // SELECT latest year
        .mockResolvedValueOnce({ rows: [mockAssessment] });      // INSERT/UPDATE assessment

      await adminController.updatePropertyDetails(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockUpdatedProperty,
          currentAssessment: mockAssessment
        })
      );
    });

    it('should handle invalid status', async () => {
      req.params.id = 'prop1';
      req.body = {
        status: 'invalid'
      };

      const mockUpdatedProperty = {
        id: 'prop1',
        updated_at: new Date()
      };

      const mockAssessment = {
        id: 'assess_prop1_2025',
        property_id: 'prop1',
        year: 2025,
        status: 'invalid',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUpdatedProperty] })  // UPDATE properties
        .mockResolvedValueOnce({ rows: [{ year: 2025 }] })       // SELECT latest year
        .mockResolvedValueOnce({ rows: [mockAssessment] });      // INSERT/UPDATE assessment

      await adminController.updatePropertyDetails(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockUpdatedProperty,
          currentAssessment: mockAssessment
        })
      );
    });

    it('should handle zero and falsy values correctly', async () => {
      req.params.id = 'prop1';
      req.body = {
        annualTax: 0,
        estimatedAnnualTax: 0,
        reportUrl: '',
        status: 'preparing'
      };

      const mockUpdatedProperty = {
        id: 'prop1',
        updated_at: new Date()
      };

      const mockAssessment = {
        id: 'assess_prop1_2025',
        property_id: 'prop1',
        year: 2025,
        annualTax: 0,
        estimatedAnnualTax: 0,
        reportUrl: '',
        status: 'preparing',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUpdatedProperty] })  // UPDATE properties
        .mockResolvedValueOnce({ rows: [{ year: 2025 }] })       // SELECT latest year
        .mockResolvedValueOnce({ rows: [mockAssessment] });      // INSERT/UPDATE assessment

      await adminController.updatePropertyDetails(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockUpdatedProperty,
          currentAssessment: mockAssessment
        })
      );
    });

    it('should send email notification when status is set to ready', async () => {
      const originalEnv = process.env.CLERK_SECRET_KEY;
      process.env.CLERK_SECRET_KEY = 'test_clerk_key';

      req.params.id = 'prop1';
      req.body = {
        status: 'ready',
        annualTax: 5000,
        estimatedAnnualTax: 4000
      };

      const mockUpdatedProperty = {
        id: 'prop1',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        user_id: 'user123',
        updated_at: new Date()
      };

      const mockAssessment = {
        id: 'assess_prop1_2025',
        property_id: 'prop1',
        year: 2025,
        annual_tax: 5000,
        estimated_annual_tax: 4000,
        status: 'ready',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUpdatedProperty] })  // UPDATE properties
        .mockResolvedValueOnce({ rows: [{ year: 2025 }] })       // SELECT latest year
        .mockResolvedValueOnce({ rows: [mockAssessment] });      // INSERT/UPDATE assessment

      // Mock Clerk API to return user email
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          email_addresses: [{ email_address: 'user@example.com' }]
        })
      });

      mockSendAssessmentReadyNotification.mockResolvedValue();

      await adminController.updatePropertyDetails(req, res);

      // Wait for async email to be called
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockSendAssessmentReadyNotification).toHaveBeenCalledWith(
        mockUpdatedProperty,
        { annualTax: 5000, estimatedAnnualTax: 4000 },
        'user@example.com'
      );

      process.env.CLERK_SECRET_KEY = originalEnv;
      delete global.fetch;
    });

    it('should not send email when status is not ready', async () => {
      req.params.id = 'prop1';
      req.body = {
        status: 'preparing'
      };

      const mockUpdatedProperty = {
        id: 'prop1',
        updated_at: new Date()
      };

      const mockAssessment = {
        id: 'assess_prop1_2025',
        property_id: 'prop1',
        year: 2025,
        status: 'preparing',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUpdatedProperty] })  // UPDATE properties
        .mockResolvedValueOnce({ rows: [{ year: 2025 }] })       // SELECT latest year
        .mockResolvedValueOnce({ rows: [mockAssessment] });      // INSERT/UPDATE assessment

      await adminController.updatePropertyDetails(req, res);

      expect(mockSendAssessmentReadyNotification).not.toHaveBeenCalled();
    });

    it('should not send email when Clerk API fails', async () => {
      const originalEnv = process.env.CLERK_SECRET_KEY;
      process.env.CLERK_SECRET_KEY = 'test_clerk_key';

      req.params.id = 'prop1';
      req.body = {
        status: 'ready'
      };

      const mockUpdatedProperty = {
        id: 'prop1',
        user_id: 'user123',
        updated_at: new Date()
      };

      const mockAssessment = {
        id: 'assess_prop1_2025',
        property_id: 'prop1',
        year: 2025,
        status: 'ready',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUpdatedProperty] })  // UPDATE properties
        .mockResolvedValueOnce({ rows: [{ year: 2025 }] })       // SELECT latest year
        .mockResolvedValueOnce({ rows: [mockAssessment] });      // INSERT/UPDATE assessment

      // Mock Clerk API to fail
      global.fetch = jest.fn().mockResolvedValue({
        ok: false
      });

      await adminController.updatePropertyDetails(req, res);

      expect(mockSendAssessmentReadyNotification).not.toHaveBeenCalled();

      process.env.CLERK_SECRET_KEY = originalEnv;
      delete global.fetch;
    });

    it('should handle Clerk API errors when sending ready notification', async () => {
      const originalEnv = process.env.CLERK_SECRET_KEY;
      process.env.CLERK_SECRET_KEY = 'test_clerk_key';

      req.params.id = 'prop1';
      req.body = {
        status: 'ready'
      };

      const mockUpdatedProperty = {
        id: 'prop1',
        user_id: 'user123',
        updated_at: new Date()
      };

      const mockAssessment = {
        id: 'assess_prop1_2025',
        property_id: 'prop1',
        year: 2025,
        status: 'ready',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUpdatedProperty] })  // UPDATE properties
        .mockResolvedValueOnce({ rows: [{ year: 2025 }] })       // SELECT latest year
        .mockResolvedValueOnce({ rows: [mockAssessment] });      // INSERT/UPDATE assessment

      // Mock Clerk API to throw error
      global.fetch = jest.fn().mockRejectedValue(new Error('Clerk API error'));

      await adminController.updatePropertyDetails(req, res);

      // Should still respond successfully even if email fails
      expect(res.json).toHaveBeenCalled();
      expect(mockSendAssessmentReadyNotification).not.toHaveBeenCalled();

      process.env.CLERK_SECRET_KEY = originalEnv;
      delete global.fetch;
    });

    it('should not send email when no user email is available', async () => {
      const originalEnv = process.env.CLERK_SECRET_KEY;
      process.env.CLERK_SECRET_KEY = 'test_clerk_key';

      req.params.id = 'prop1';
      req.body = {
        status: 'ready'
      };

      const mockUpdatedProperty = {
        id: 'prop1',
        user_id: 'user123',
        updated_at: new Date()
      };

      const mockAssessment = {
        id: 'assess_prop1_2025',
        property_id: 'prop1',
        year: 2025,
        status: 'ready',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUpdatedProperty] })  // UPDATE properties
        .mockResolvedValueOnce({ rows: [{ year: 2025 }] })       // SELECT latest year
        .mockResolvedValueOnce({ rows: [mockAssessment] });      // INSERT/UPDATE assessment

      // Mock Clerk API to return no email
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          email_addresses: []
        })
      });

      await adminController.updatePropertyDetails(req, res);

      expect(mockSendAssessmentReadyNotification).not.toHaveBeenCalled();

      process.env.CLERK_SECRET_KEY = originalEnv;
      delete global.fetch;
    });

    it('should not send email when CLERK_SECRET_KEY is not set', async () => {
      const originalEnv = process.env.CLERK_SECRET_KEY;
      delete process.env.CLERK_SECRET_KEY;

      req.params.id = 'prop1';
      req.body = {
        status: 'ready'
      };

      const mockUpdatedProperty = {
        id: 'prop1',
        user_id: 'user123',
        updated_at: new Date()
      };

      const mockAssessment = {
        id: 'assess_prop1_2025',
        property_id: 'prop1',
        year: 2025,
        status: 'ready',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUpdatedProperty] })  // UPDATE properties
        .mockResolvedValueOnce({ rows: [{ year: 2025 }] })       // SELECT latest year
        .mockResolvedValueOnce({ rows: [mockAssessment] });      // INSERT/UPDATE assessment

      await adminController.updatePropertyDetails(req, res);

      expect(mockSendAssessmentReadyNotification).not.toHaveBeenCalled();

      if (originalEnv) {
        process.env.CLERK_SECRET_KEY = originalEnv;
      }
    });
  });

  describe('markPropertyAsReady', () => {
    it('should mark property as ready', async () => {
      req.params.id = 'prop1';
      const mockProperty = {
        id: 'prop1',
        address: '123 Main St',
        status: 'ready',
        updated_at: new Date()
      };

      mockQuery.mockResolvedValue({ rows: [mockProperty] });

      await adminController.markPropertyAsReady(req, res);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'ready'"),
        ['prop1']
      );
      expect(res.json).toHaveBeenCalledWith(mockProperty);
    });

    it('should return 404 if property does not exist', async () => {
      req.params.id = 'nonexistent';
      mockQuery.mockResolvedValue({ rows: [] });

      await adminController.markPropertyAsReady(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Property not found' });
    });

    it('should handle database errors', async () => {
      req.params.id = 'prop1';
      mockQuery.mockRejectedValue(new Error('Database error'));

      await adminController.markPropertyAsReady(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to mark property as ready' });
    });
  });

  describe('pullPropertyData', () => {
    const originalEnv = process.env.GOOGLE_MAPS_API_KEY;

    beforeEach(() => {
      process.env.GOOGLE_MAPS_API_KEY = 'test_api_key';
    });

    afterEach(() => {
      if (originalEnv) {
        process.env.GOOGLE_MAPS_API_KEY = originalEnv;
      } else {
        delete process.env.GOOGLE_MAPS_API_KEY;
      }
    });

    it('should pull property data from county website', async () => {
      req.params.id = 'prop1';

      const mockProperty = {
        address: '123 Main St',
        city: 'Atlanta',
        state: 'GA',
        zip_code: '30301'
      };

      mockQuery.mockResolvedValue({ rows: [mockProperty] });

      mockParseAddressForScraping.mockResolvedValue({
        streetAddress: '123 Main St',
        county: 'fulton'
      });

      mockScrapeProperty.mockResolvedValue({
        bedrooms: 3,
        bathrooms: 2.5,
        sqft: 1800,
        homesteadExemption: true
      });

      await adminController.pullPropertyData(req, res);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT address'),
        ['prop1']
      );
      expect(mockParseAddressForScraping).toHaveBeenCalledWith(
        '123 Main St, Atlanta, GA, 30301',
        'test_api_key'
      );
      expect(mockScrapeProperty).toHaveBeenCalledWith('123 Main St', 'fulton');
      expect(res.json).toHaveBeenCalledWith({
        bedrooms: 3,
        bathrooms: 2.5,
        sqft: 1800,
        homesteadExemption: true,
        county: 'fulton',
        streetAddress: '123 Main St'
      });
    });

    it('should return 404 if property not found', async () => {
      req.params.id = 'nonexistent';
      mockQuery.mockResolvedValue({ rows: [] });

      await adminController.pullPropertyData(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Property not found' });
    });

    it('should return 500 if API key not configured', async () => {
      delete process.env.GOOGLE_MAPS_API_KEY;

      req.params.id = 'prop1';
      mockQuery.mockResolvedValue({
        rows: [{ address: '123 Main St', city: 'Atlanta', state: 'GA', zip_code: '30301' }]
      });

      await adminController.pullPropertyData(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Google Maps API key not configured' });
    });

    it('should return 400 if address not in supported county', async () => {
      req.params.id = 'prop1';
      mockQuery.mockResolvedValue({
        rows: [{ address: '123 Main St', city: 'Miami', state: 'FL', zip_code: '33101' }]
      });

      mockParseAddressForScraping.mockRejectedValue(
        new Error('Address is in miami-dade county. Only these Georgia counties are supported: fulton, gwinnett, cobb')
      );

      await adminController.pullPropertyData(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Address not in supported county',
        message: 'Address is in miami-dade county. Only these Georgia counties are supported: fulton, gwinnett, cobb'
      });
    });

    it('should return 400 if scraper fails to find property', async () => {
      req.params.id = 'prop1';
      mockQuery.mockResolvedValue({
        rows: [{ address: '999 Fake St', city: 'Atlanta', state: 'GA', zip_code: '30301' }]
      });

      mockParseAddressForScraping.mockResolvedValue({
        streetAddress: '999 Fake St',
        county: 'fulton'
      });

      mockScrapeProperty.mockResolvedValue(null);

      await adminController.pullPropertyData(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to scrape property data',
        message: 'Could not find property on county website'
      });
    });

    it('should handle database errors', async () => {
      req.params.id = 'prop1';
      mockQuery.mockRejectedValue(new Error('Database error'));

      await adminController.pullPropertyData(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to pull property data' });
    });
  });
});
