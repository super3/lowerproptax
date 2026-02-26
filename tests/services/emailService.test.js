import { jest } from '@jest/globals';

// Mock Resend before importing emailService
const mockSend = jest.fn();
jest.unstable_mockModule('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend }
  }))
}));

describe('Email Service', () => {
  let sendAssessmentReadyNotification;
  let sendReportPurchasedNotification;
  let consoleSpy;

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
      sendAssessmentReadyNotification = emailService.sendAssessmentReadyNotification;
      sendReportPurchasedNotification = emailService.sendReportPurchasedNotification;
    });

    afterEach(() => {
      delete process.env.RESEND_API_KEY;
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
            text: expect.stringContaining('https://calendly.com/shawn-lowerproptax/new-meeting')
          })
        );
        expect(consoleSpy).toHaveBeenCalledWith('Assessment ready notification sent for property prop_123 to user@example.com');
      });

      it('should send different email when no savings', async () => {
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
            subject: 'Your Property Assessment is Complete',
            text: expect.stringContaining('we didn\'t find any savings opportunity')
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
            subject: 'Your Property Assessment is Complete'
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

    describe('sendReportPurchasedNotification', () => {
      it('should send email with report URL when available', async () => {
        mockSend.mockResolvedValueOnce({ id: 'email_456' });

        const recipient = {
          address: '6774 Encore Blvd',
          email: 'buyer@example.com',
          report_url: 'https://example.com/report.pdf',
          recipient_name: 'Christopher Porcelli'
        };

        await sendReportPurchasedNotification(recipient);

        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            from: 'LowerPropTax <help@lowerproptax.com>',
            to: 'buyer@example.com',
            bcc: 'help@lowerproptax.com',
            subject: 'Your Property Tax Savings Report - 6774 Encore Blvd',
            text: expect.stringContaining('Hi Christopher')
          })
        );
        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining('https://example.com/report.pdf')
          })
        );
      });

      it('should send email without report URL when not available', async () => {
        mockSend.mockResolvedValueOnce({ id: 'email_789' });

        const recipient = {
          address: '123 Main St',
          email: 'buyer@example.com',
          report_url: null,
          recipient_name: 'Jane Doe'
        };

        await sendReportPurchasedNotification(recipient);

        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining('being finalized')
          })
        );
      });

      it('should handle email send errors gracefully', async () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockSend.mockRejectedValueOnce(new Error('SMTP failed'));

        const recipient = {
          address: '123 Main St',
          email: 'buyer@example.com',
          report_url: null,
          recipient_name: 'Test User'
        };

        await sendReportPurchasedNotification(recipient);

        expect(errorSpy).toHaveBeenCalledWith('Failed to send report purchased notification:', 'SMTP failed');
      });
    });
  });

  describe('when RESEND_API_KEY is not set', () => {
    beforeEach(async () => {
      delete process.env.RESEND_API_KEY;
      jest.resetModules();
      const emailService = await import('../../src/services/emailService.js');
      sendAssessmentReadyNotification = emailService.sendAssessmentReadyNotification;
      sendReportPurchasedNotification = emailService.sendReportPurchasedNotification;
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

    it('should log message and return early for report purchased notification', async () => {
      const recipient = {
        address: '123 Main St',
        email: 'buyer@example.com',
        report_url: null,
        recipient_name: 'Test User'
      };

      await sendReportPurchasedNotification(recipient);

      expect(consoleSpy).toHaveBeenCalledWith('Email service not configured (RESEND_API_KEY missing)');
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
