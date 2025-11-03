// Mock in-memory database for testing when PostgreSQL is not available
const mockData = new Map();

export function createMockPool() {
  return {
    query: async (sql, params) => {
      // Parse SQL to determine operation
      const sqlUpper = sql.trim().toUpperCase();

      // DELETE FROM properties
      if (sqlUpper.startsWith('DELETE FROM PROPERTIES') && !params) {
        mockData.clear();
        return { rows: [], rowCount: 0 };
      }

      // DELETE with ID
      if (sqlUpper.startsWith('DELETE FROM PROPERTIES WHERE')) {
        const id = params[0];
        const deleted = mockData.delete(id);
        return { rows: [], rowCount: deleted ? 1 : 0 };
      }

      // INSERT
      if (sqlUpper.startsWith('INSERT INTO PROPERTIES')) {
        const [id, userId, address, city, state, zipCode, country, lat, lng] = params;
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
        return { rows: [property], rowCount: 1 };
      }

      // SELECT all for user
      if (sqlUpper.includes('ORDER BY CREATED_AT DESC')) {
        const userId = params[0];
        const properties = Array.from(mockData.values()).filter(
          p => p.userId === userId
        );
        return { rows: properties, rowCount: properties.length };
      }

      // SELECT single by ID (for getProperty)
      if (sqlUpper.startsWith('SELECT ID, USER_ID')) {
        const id = params[0];
        const property = mockData.get(id);
        return { rows: property ? [property] : [], rowCount: property ? 1 : 0 };
      }

      // SELECT user_id only (for ownership check)
      if (sqlUpper.startsWith('SELECT USER_ID FROM PROPERTIES')) {
        const id = params[0];
        const property = mockData.get(id);
        return {
          rows: property ? [{ user_id: property.userId }] : [],
          rowCount: property ? 1 : 0
        };
      }

      // UPDATE
      if (sqlUpper.startsWith('UPDATE PROPERTIES')) {
        const id = params[params.length - 1];
        const property = mockData.get(id);
        if (!property) {
          return { rows: [], rowCount: 0 };
        }

        const [address, city, state, zipCode, country, lat, lng] = params;
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
        return { rows: [updated], rowCount: 1 };
      }

      // Default: return empty
      return { rows: [], rowCount: 0 };
    },
    on: () => {},
    end: async () => {}
  };
}
