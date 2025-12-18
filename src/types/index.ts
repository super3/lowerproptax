import { Request, Response, NextFunction } from 'express';

// User types
export interface User {
  id: string;
  email?: string;
  username?: string;
}

// Property types
export interface Property {
  id: string;
  userId: string;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  lat?: number | null;
  lng?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqft?: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  latestAssessment?: Assessment | null;
  assessments?: Assessment[];
  currentAssessment?: Assessment | CurrentAssessmentPlaceholder;
  userEmail?: string | null;
}

export interface CurrentAssessmentPlaceholder {
  year: number;
  appraisedValue: null;
  annualTax: null;
  estimatedAppraisedValue: null;
  estimatedAnnualTax: null;
  reportUrl: null;
  status: string;
}

export interface Assessment {
  id: string;
  year: number;
  appraisedValue?: number | null;
  annualTax?: number | null;
  estimatedAppraisedValue?: number | null;
  estimatedAnnualTax?: number | null;
  reportUrl?: string | null;
  status?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// Request types
export interface AuthenticatedRequest extends Request {
  user: User;
}

// Express types
export type ExpressMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

export type AuthenticatedMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

// Database types
export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

export interface Pool {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<QueryResult<T>>;
  on: (event: string, callback: (err?: Error) => void) => void;
  end: () => Promise<void>;
}

// Property create/update request body types
export interface CreatePropertyBody {
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

export interface UpdatePropertyBody {
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

export interface UpdatePropertyDetailsBody {
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  year?: number;
  appraisedValue?: number;
  annualTax?: number;
  estimatedAppraisedValue?: number;
  estimatedAnnualTax?: number;
  reportUrl?: string;
  status?: string;
}

// Email types
export interface EmailProperty {
  id: string;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface EmailAssessment {
  annualTax?: number | string;
  estimatedAnnualTax?: number | string;
}
