import { jest } from '@jest/globals';

// Mock Resend before importing emailService
const mockSend = jest.fn();
jest.unstable_mockModule('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend }
  }))
}));

describe('Email Service', () => {
  let sendReferralVisitNotification;
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
      sendReferralVisitNotification = emailService.sendReferralVisitNotification;
      sendReportPurchasedNotification = emailService.sendReportPurchasedNotification;
    });

    afterEach(() => {
      delete process.env.RESEND_API_KEY;
    });

    it('should send referral visit notification with all details', async () => {
      mockSend.mockResolvedValueOnce({ id: 'email_123' });

      const recipient = {
        address: '6774 Encore Blvd',
        short_code: '6774e',
        recipient_name: 'Christopher Porcelli'
      };

      const visitInfo = {
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        visited_at: '2026-03-19T10:00:00Z',
        visit_count: 3
      };

      await sendReferralVisitNotification(recipient, visitInfo);

      expect(mockSend).toHaveBeenCalledWith({
        from: 'LowerPropTax <help@lowerproptax.com>',
        to: 'help@lowerproptax.com',
        subject: 'Mailer Link Opened - 6774 Encore Blvd',
        text: expect.stringContaining('Owner: Christopher Porcelli')
      });
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Short Code: 6774e')
        })
      );
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Visit #: 3')
        })
      );
      expect(consoleSpy).toHaveBeenCalledWith('Referral visit notification sent for 6774e');
    });

    it('should handle missing optional fields gracefully', async () => {
      mockSend.mockResolvedValueOnce({ id: 'email_456' });

      const recipient = {
        address: '123 Main St',
        short_code: '123m'
      };

      const visitInfo = {
        visited_at: '2026-03-19T10:00:00Z',
        visit_count: 1
      };

      await sendReferralVisitNotification(recipient, visitInfo);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Owner: Unknown')
        })
      );
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('IP: Unknown')
        })
      );
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('User Agent: Unknown')
        })
      );
    });

    it('should handle email send errors gracefully', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockSend.mockRejectedValueOnce(new Error('SMTP connection failed'));

      const recipient = {
        address: '123 Main St',
        short_code: '123m',
        recipient_name: 'Test User'
      };

      const visitInfo = {
        ip_address: '10.0.0.1',
        user_agent: 'TestBot',
        visited_at: '2026-03-19T10:00:00Z',
        visit_count: 1
      };

      await sendReferralVisitNotification(recipient, visitInfo);

      expect(errorSpy).toHaveBeenCalledWith('Failed to send referral visit notification:', 'SMTP connection failed');
    });

    it('should send report purchased notification', async () => {
      mockSend.mockResolvedValueOnce({ id: 'email_789' });

      const recipient = {
        recipient_name: 'Christopher Porcelli',
        address: '6774 Encore Blvd',
        email: 'buyer@example.com'
      };

      await sendReportPurchasedNotification(recipient);

      expect(mockSend).toHaveBeenCalledWith({
        from: 'LowerPropTax <help@lowerproptax.com>',
        to: 'help@lowerproptax.com',
        subject: 'Report Purchased - 6774 Encore Blvd',
        text: expect.stringContaining('Owner: Christopher Porcelli')
      });
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Email: buyer@example.com')
        })
      );
      expect(consoleSpy).toHaveBeenCalledWith('Report purchased notification sent for 6774 Encore Blvd');
    });

    it('should handle missing optional fields in report purchased notification', async () => {
      mockSend.mockResolvedValueOnce({ id: 'email_790' });

      const recipient = {
        address: '123 Main St'
      };

      await sendReportPurchasedNotification(recipient);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Owner: Unknown')
        })
      );
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Email: Not provided')
        })
      );
    });

    it('should handle report purchased notification errors gracefully', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockSend.mockRejectedValueOnce(new Error('SMTP failed'));

      const recipient = {
        recipient_name: 'Test',
        address: '123 Main St',
        email: 'test@example.com'
      };

      await sendReportPurchasedNotification(recipient);

      expect(errorSpy).toHaveBeenCalledWith('Failed to send report purchased notification:', 'SMTP failed');
    });
  });

  describe('when RESEND_API_KEY is not set', () => {
    beforeEach(async () => {
      delete process.env.RESEND_API_KEY;
      jest.resetModules();
      const emailService = await import('../../src/services/emailService.js');
      sendReferralVisitNotification = emailService.sendReferralVisitNotification;
      sendReportPurchasedNotification = emailService.sendReportPurchasedNotification;
    });

    it('should log message and return early for referral visit notification', async () => {
      const recipient = {
        address: '123 Main St',
        short_code: '123m'
      };

      const visitInfo = {
        visited_at: '2026-03-19T10:00:00Z',
        visit_count: 1
      };

      await sendReferralVisitNotification(recipient, visitInfo);

      expect(consoleSpy).toHaveBeenCalledWith('Email service not configured (RESEND_API_KEY missing)');
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should log message and return early for report purchased notification', async () => {
      const recipient = {
        recipient_name: 'Test',
        address: '123 Main St',
        email: 'test@example.com'
      };

      await sendReportPurchasedNotification(recipient);

      expect(consoleSpy).toHaveBeenCalledWith('Email service not configured (RESEND_API_KEY missing)');
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
