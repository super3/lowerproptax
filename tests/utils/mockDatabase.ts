import type { Pool, QueryResult } from '../../src/types/index.js';

// Mock in-memory database for testing when PostgreSQL is not available
const mockData = new Map<string, Record<string, unknown>>();
const mockAssessments = new Map<string, Record<string, unknown>>();

interface MockAssessment {
  id: string;
  year: number;
  appraisedValue?: number | null;
  annualTax?: number | null;
  estimatedAppraisedValue?: number | null;
  estimatedAnnualTax?: number | null;
  reportUrl?: string | null;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Helper to add an assessment to a property for testing
export function addMockAssessment(propertyId: string, assessment: MockAssessment): void {
  mockAssessments.set(propertyId, assessment);
}

// Helper to clear assessments
export function clearMockAssessments(): void {
  mockAssessments.clear();
}

export function createMockPool(): Pool {
  return {
    query: async <T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>> => {
      // Parse SQL to determine operation
      const sqlUpper = sql.trim().toUpperCase();

      // DELETE FROM properties
      if (sqlUpper.startsWith('DELETE FROM PROPERTIES') && !params) {
        mockData.clear();
        return { rows: [] as T[], rowCount: 0 };
      }

      // DELETE with ID
      if (sqlUpper.startsWith('DELETE FROM PROPERTIES WHERE')) {
        const id = params![0] as string;
        const deleted = mockData.delete(id);
        return { rows: [] as T[], rowCount: deleted ? 1 : 0 };
      }

      // INSERT
      if (sqlUpper.startsWith('INSERT INTO PROPERTIES')) {
        const [id, userId, address, city, state, zipCode, country, lat, lng] = params as [string, string, string, string, string, string, string, number | null, number | null];
        const property = {
          id,
          userId,
          address,
          city,
          state,
          zipCode,
          country,
          lat,
          lng,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        mockData.set(id, property);
        return { rows: [property] as T[], rowCount: 1 };
      }

      // SELECT all for user (with LEFT JOIN for assessments)
      if (sqlUpper.includes('ORDER BY P.CREATED_AT DESC') || sqlUpper.includes('ORDER BY CREATED_AT DESC')) {
        const userId = params![0] as string;
        const properties = Array.from(mockData.values())
          .filter(p => p.userId === userId)
          .map(p => {
            const assessment = mockAssessments.get(p.id as string) as MockAssessment | undefined;
            return {
              ...p,
              // Include assessment fields from mockAssessments or null
              assessmentId: assessment?.id || null,
              assessmentYear: assessment?.year || null,
              assessmentAppraisedValue: assessment?.appraisedValue || null,
              assessmentAnnualTax: assessment?.annualTax || null,
              assessmentEstimatedAppraisedValue: assessment?.estimatedAppraisedValue || null,
              assessmentEstimatedAnnualTax: assessment?.estimatedAnnualTax || null,
              assessmentReportUrl: assessment?.reportUrl || null,
              assessmentStatus: assessment?.status || null,
              assessmentCreatedAt: assessment?.createdAt || null,
              assessmentUpdatedAt: assessment?.updatedAt || null
            };
          });
        return { rows: properties as T[], rowCount: properties.length };
      }

      // SELECT single by ID (for getProperty)
      if (sqlUpper.startsWith('SELECT ID, USER_ID')) {
        const id = params![0] as string;
        const property = mockData.get(id);
        return { rows: property ? [property] as T[] : [] as T[], rowCount: property ? 1 : 0 };
      }

      // SELECT user_id only (for ownership check)
      if (sqlUpper.startsWith('SELECT USER_ID FROM PROPERTIES')) {
        const id = params![0] as string;
        const property = mockData.get(id);
        return {
          rows: property ? [{ user_id: property.userId }] as T[] : [] as T[],
          rowCount: property ? 1 : 0
        };
      }

      // UPDATE
      if (sqlUpper.startsWith('UPDATE PROPERTIES')) {
        const id = params![params!.length - 1] as string;
        const property = mockData.get(id);
        if (!property) {
          return { rows: [] as T[], rowCount: 0 };
        }

        const [address, city, state, zipCode, country, lat, lng] = params as [string | null, string | null, string | null, string | null, string | null, number | null, number | null, string];
        const updated = {
          ...property,
          address: address !== null ? address : property.address,
          city: city !== null ? city : property.city,
          state: state !== null ? state : property.state,
          zipCode: zipCode !== null ? zipCode : property.zipCode,
          country: country !== null ? country : property.country,
          lat: lat !== null ? lat : property.lat,
          lng: lng !== null ? lng : property.lng,
          updatedAt: new Date().toISOString()
        };
        mockData.set(id, updated);
        return { rows: [updated] as T[], rowCount: 1 };
      }

      // Default: return empty
      return { rows: [] as T[], rowCount: 0 };
    },
    on: () => {},
    end: async () => {}
  };
}
