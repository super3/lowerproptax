import { jest } from '@jest/globals';
import type { Request, Response } from 'express';

// Mock user type
export interface MockUser {
  id: string;
  emailAddresses: Array<{ emailAddress: string }>;
  username: string;
  firstName: string;
  lastName: string;
}

// Mock session type
export interface MockSession {
  id: string;
  userId: string;
  status: string;
}

// Mock Clerk SDK for testing
export const mockUser: MockUser = {
  id: 'user_123',
  emailAddresses: [{ emailAddress: 'test@example.com' }],
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User'
};

export const mockSession: MockSession = {
  id: 'sess_123',
  userId: mockUser.id,
  status: 'active'
};

export interface MockClerkClient {
  sessions: {
    getSession: jest.Mock;
  };
  users: {
    getUser: jest.Mock;
  };
}

export const createMockClerkClient = (): MockClerkClient => ({
  sessions: {
    getSession: jest.fn().mockResolvedValue(mockSession)
  },
  users: {
    getUser: jest.fn().mockResolvedValue(mockUser)
  }
});

// Helper to create a valid JWT token structure for testing
export const createMockToken = (payload: Record<string, unknown> = {}): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64');
  const body = Buffer.from(JSON.stringify({
    sub: mockUser.id,
    sid: mockSession.id,
    ...payload
  })).toString('base64');
  const signature = 'mock_signature';
  return `${header}.${body}.${signature}`;
};

export interface MockRequest extends Partial<Request> {
  headers: Record<string, string>;
  body: Record<string, unknown>;
  params: Record<string, string>;
  query: Record<string, unknown>;
  user: { id: string; email?: string } | null;
}

// Helper to create express request mock
export const createMockRequest = (overrides: Partial<MockRequest> = {}): MockRequest => ({
  headers: {},
  body: {},
  params: {},
  query: {},
  user: null,
  ...overrides
});

export interface MockResponse {
  status: jest.Mock;
  json: jest.Mock;
  send: jest.Mock;
}

// Helper to create express response mock
export const createMockResponse = (): MockResponse => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis()
  };
  return res;
};

// Helper to create express next function mock
export const createMockNext = (): jest.Mock => jest.fn();
