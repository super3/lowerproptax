import { jest } from '@jest/globals';

// Mock Resend before importing emailService
const mockSend = jest.fn();
jest.unstable_mockModule('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend }
  }))
}));

describe('Email Service', () => {
  let sendNewPropertyNotification: (property: { id: string; address: string; city?: string; state?: string; zipCode?: string }, userEmail: string | null) => Promise<void>;
  let sendAssessmentReadyNotification: (property: { id: string; address: string; city?: string; state?: string; zipCode?: string }, assessment: { annualTax?: number; estimatedAnnualTax?: number }, userEmail: string) => Promise<void>;
  let consoleSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('when RESEND_API_KEY is set', () => {
    beforeEach(async () => {
      process.env.RESEND_API_KEY = 'test_api_key';
      jest.resetModules();
      const emailService = await import('../../src/services/emailService.js');
      sendNewPropertyNotification = emailService.sendNewPropertyNotification;
      sendAssessmentReadyNotification = emailService.sendAssessmentReadyNotification;
    });

    afterEach(() => {
      delete process.env.RESEND_API_KEY;
    });

    it('should send email with full property details', async () => {
      mockSend.mockResolvedValueOnce({ id: 'email_123' });

      const property = {
        id: 'prop_123',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701'
      };

      await sendNewPropertyNotification(property, 'user@example.com');

      expect(mockSend).toHaveBeenCalledWith({
        from: 'LowerPropTax <help@lowerproptax.com>',
        to: 'help@lowerproptax.com',
        subject: 'New Property Added - 123 Main St',
        text: expect.stringContaining('Property ID: prop_123')
      });
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Address: 123 Main St, Austin, TX, 78701')
        })
      );
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('User Email: user@example.com')
        })
      );
      expect(consoleSpy).toHaveBeenCalledWith('Email notification sent for property prop_123');
    });

    it('should send email with minimal property details', async () => {
      mockSend.mockResolvedValueOnce({ id: 'email_123' });

      const property = {
        id: 'prop_456',
        address: '456 Oak Ave'
      };

      await sendNewPropertyNotification(property, null);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'New Property Added - 456 Oak Ave',
          text: expect.stringContaining('Address: 456 Oak Ave')
        })
      );
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('User Email: Not available')
        })
      );
    });

    it('should handle email send errors gracefully', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockSend.mockRejectedValueOnce(new Error('SMTP connection failed'));

      const property = {
        id: 'prop_789',
        address: '789 Elm St'
      };

      await sendNewPropertyNotification(property, 'user@example.com');

      expect(errorSpy).toHaveBeenCalledWith('Failed to send email notification:', 'SMTP connection failed');
    });

    describe('sendAssessmentReadyNotification', () => {
      it('should send email with savings when positive', async () => {
        mockSend.mockResolvedValueOnce({ id: 'email_123' });

        const property = {
          id: 'prop_123',
          address: '123 Main St',
          city: 'Austin',
          state: 'TX',
          zipCode: '78701'
        };

        const assessment = {
          annualTax: 5000,
          estimatedAnnualTax: 4000
        };

        await sendAssessmentReadyNotification(property, assessment, 'user@example.com');

        expect(mockSend).toHaveBeenCalledWith({
          from: 'LowerPropTax <help@lowerproptax.com>',
          to: 'user@example.com',
          subject: 'Your Property Assessment is Ready - $1,000.00 in Potential Savings',
          text: expect.stringContaining('Potential Annual Savings: $1,000.00')
        });
        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining('https://lowerproptax.com/property.html?id=prop_123')
          })
        );
        expect(consoleSpy).toHaveBeenCalledWith('Assessment ready notification sent for property prop_123 to user@example.com');
      });

      it('should show $0.00 savings when no savings', async () => {
        mockSend.mockResolvedValueOnce({ id: 'email_123' });

        const property = {
          id: 'prop_456',
          address: '456 Oak Ave'
        };

        const assessment = {
          annualTax: 4000,
          estimatedAnnualTax: 4500
        };

        await sendAssessmentReadyNotification(property, assessment, 'user@example.com');

        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            subject: 'Your Property Assessment is Ready - $0.00 in Potential Savings',
            text: expect.stringContaining('Potential Annual Savings: $0.00')
          })
        );
      });

      it('should handle missing tax values', async () => {
        mockSend.mockResolvedValueOnce({ id: 'email_123' });

        const property = {
          id: 'prop_789',
          address: '789 Elm St'
        };

        const assessment = {};

        await sendAssessmentReadyNotification(property, assessment, 'user@example.com');

        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            subject: 'Your Property Assessment is Ready - $0.00 in Potential Savings'
          })
        );
      });

      it('should handle email send errors gracefully', async () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockSend.mockRejectedValueOnce(new Error('SMTP connection failed'));

        const property = {
          id: 'prop_123',
          address: '123 Main St'
        };

        const assessment = { annualTax: 5000, estimatedAnnualTax: 4000 };

        await sendAssessmentReadyNotification(property, assessment, 'user@example.com');

        expect(errorSpy).toHaveBeenCalledWith('Failed to send assessment ready notification:', 'SMTP connection failed');
      });
    });
  });

  describe('when RESEND_API_KEY is not set', () => {
    beforeEach(async () => {
      delete process.env.RESEND_API_KEY;
      jest.resetModules();
      const emailService = await import('../../src/services/emailService.js');
      sendNewPropertyNotification = emailService.sendNewPropertyNotification;
      sendAssessmentReadyNotification = emailService.sendAssessmentReadyNotification;
    });

    it('should log message and return early for new property notification', async () => {
      const property = {
        id: 'prop_123',
        address: '123 Main St'
      };

      await sendNewPropertyNotification(property, 'user@example.com');

      expect(consoleSpy).toHaveBeenCalledWith('Email service not configured (RESEND_API_KEY missing)');
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should log message and return early for assessment ready notification', async () => {
      const property = {
        id: 'prop_123',
        address: '123 Main St'
      };

      const assessment = { annualTax: 5000, estimatedAnnualTax: 4000 };

      await sendAssessmentReadyNotification(property, assessment, 'user@example.com');

      expect(consoleSpy).toHaveBeenCalledWith('Email service not configured (RESEND_API_KEY missing)');
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
