import { jest } from '@jest/globals';

// Mock Clerk SDK for testing
export const mockUser = {
  id: 'user_123',
  emailAddresses: [{ emailAddress: 'test@example.com' }],
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User'
};

export const mockSession = {
  id: 'sess_123',
  userId: mockUser.id,
  status: 'active'
};

export const createMockClerkClient = () => ({
  sessions: {
    getSession: jest.fn().mockResolvedValue(mockSession)
  },
  users: {
    getUser: jest.fn().mockResolvedValue(mockUser)
  }
});

// Helper to create a valid JWT token structure for testing
export const createMockToken = (payload = {}) => {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64');
  const body = Buffer.from(JSON.stringify({
    sub: mockUser.id,
    sid: mockSession.id,
    ...payload
  })).toString('base64');
  const signature = 'mock_signature';
  return `${header}.${body}.${signature}`;
};

// Helper to create express request mock
export const createMockRequest = (overrides = {}) => ({
  headers: {},
  body: {},
  params: {},
  query: {},
  user: null,
  ...overrides
});

// Helper to create express response mock
export const createMockResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis()
  };
  return res;
};

// Helper to create express next function mock
export const createMockNext = () => jest.fn();
