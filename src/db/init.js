import pool from './connection.js';

// Initialize database tables
export async function initDatabase() {
  try {
    console.log('Initializing database...');

    // Create properties table if it doesn't exist
    const createPropertiesTable = `
      CREATE TABLE IF NOT EXISTS properties (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        address VARCHAR(500) NOT NULL,
        city VARCHAR(255),
        state VARCHAR(100),
        zip_code VARCHAR(20),
        country VARCHAR(100),
        lat DECIMAL(10, 8),
        lng DECIMAL(11, 8),
        bedrooms INTEGER,
        bathrooms DECIMAL(3, 1),
        sqft INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_properties_user_id ON properties(user_id);
    `;

    await pool.query(createPropertiesTable);

    // Create assessments table if it doesn't exist
    const createAssessmentsTable = `
      CREATE TABLE IF NOT EXISTS assessments (
        id VARCHAR(255) PRIMARY KEY,
        property_id VARCHAR(255) NOT NULL,
        year INTEGER NOT NULL,
        appraised_value DECIMAL(15, 2),
        annual_tax DECIMAL(15, 2),
        status VARCHAR(50) DEFAULT 'preparing',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
        UNIQUE(property_id, year)
      );

      CREATE INDEX IF NOT EXISTS idx_assessments_property_id ON assessments(property_id);
      CREATE INDEX IF NOT EXISTS idx_assessments_year ON assessments(year);
    `;

    await pool.query(createAssessmentsTable);

    // Add estimated values and report URL to assessments table
    const assessmentColumns = [
      `ALTER TABLE assessments ADD COLUMN IF NOT EXISTS estimated_appraised_value DECIMAL(15, 2)`,
      `ALTER TABLE assessments ADD COLUMN IF NOT EXISTS estimated_annual_tax DECIMAL(15, 2)`,
      `ALTER TABLE assessments ADD COLUMN IF NOT EXISTS report_url VARCHAR(500)`
    ];

    for (const column of assessmentColumns) {
      await pool.query(column);
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}
