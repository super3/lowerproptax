import { jest } from '@jest/globals';

// Mock Resend before importing emailService
const mockSend = jest.fn();
jest.unstable_mockModule('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend }
  }))
}));

describe('Email Service', () => {
  let sendNewPropertyNotification;
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
      sendNewPropertyNotification = emailService.sendNewPropertyNotification;
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
  });

  describe('when RESEND_API_KEY is not set', () => {
    beforeEach(async () => {
      delete process.env.RESEND_API_KEY;
      jest.resetModules();
      const emailService = await import('../../src/services/emailService.js');
      sendNewPropertyNotification = emailService.sendNewPropertyNotification;
    });

    it('should log message and return early', async () => {
      const property = {
        id: 'prop_123',
        address: '123 Main St'
      };

      await sendNewPropertyNotification(property, 'user@example.com');

      expect(consoleSpy).toHaveBeenCalledWith('Email service not configured (RESEND_API_KEY missing)');
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
