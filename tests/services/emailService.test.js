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
    });

    afterEach(() => {
      delete process.env.RESEND_API_KEY;
    });

    it('should send referral visit notification with all details', async () => {
      mockSend.mockResolvedValueOnce({ id: 'email_123' });

      const property = {
        address: '6774 Encore Blvd',
        referral_code: '6774e',
        owner_name: 'Christopher Porcelli'
      };

      const visitInfo = {
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        visited_at: '2026-03-19T10:00:00Z',
        visit_count: 3
      };

      await sendReferralVisitNotification(property, visitInfo);

      expect(mockSend).toHaveBeenCalledWith({
        from: 'LowerPropTax <help@lowerproptax.com>',
        to: 'help@lowerproptax.com',
        subject: 'Mailer Link Opened - 6774 Encore Blvd',
        text: expect.stringContaining('Owner: Christopher Porcelli')
      });
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Referral Code: 6774e')
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

      const property = {
        address: '123 Main St',
        referral_code: '123m'
      };

      const visitInfo = {
        visited_at: '2026-03-19T10:00:00Z',
        visit_count: 1
      };

      await sendReferralVisitNotification(property, visitInfo);

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

      const property = {
        address: '123 Main St',
        referral_code: '123m',
        owner_name: 'Test User'
      };

      const visitInfo = {
        ip_address: '10.0.0.1',
        user_agent: 'TestBot',
        visited_at: '2026-03-19T10:00:00Z',
        visit_count: 1
      };

      await sendReferralVisitNotification(property, visitInfo);

      expect(errorSpy).toHaveBeenCalledWith('Failed to send referral visit notification:', 'SMTP connection failed');
    });
  });

  describe('when RESEND_API_KEY is not set', () => {
    beforeEach(async () => {
      delete process.env.RESEND_API_KEY;
      jest.resetModules();
      const emailService = await import('../../src/services/emailService.js');
      sendReferralVisitNotification = emailService.sendReferralVisitNotification;
    });

    it('should log message and return early for referral visit notification', async () => {
      const property = {
        address: '123 Main St',
        referral_code: '123m'
      };

      const visitInfo = {
        visited_at: '2026-03-19T10:00:00Z',
        visit_count: 1
      };

      await sendReferralVisitNotification(property, visitInfo);

      expect(consoleSpy).toHaveBeenCalledWith('Email service not configured (RESEND_API_KEY missing)');
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
