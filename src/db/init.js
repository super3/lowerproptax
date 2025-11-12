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

    // Migration: Add new columns to existing properties table if they don't exist
    const migrations = [
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS bedrooms INTEGER`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS sqft INTEGER`
    ];

    for (const migration of migrations) {
      await pool.query(migration);
    }

    // Migration: Move appraised_value and annual_tax data to assessments table
    try {
      // Get current year
      const currentYear = new Date().getFullYear();

      // Create assessments for existing properties that have appraised_value or annual_tax
      await pool.query(`
        INSERT INTO assessments (id, property_id, year, appraised_value, annual_tax, status, created_at, updated_at)
        SELECT
          'assess_' || id || '_' || $1,
          id,
          $1,
          appraised_value,
          annual_tax,
          status,
          created_at,
          updated_at
        FROM properties
        WHERE (appraised_value IS NOT NULL OR annual_tax IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM assessments WHERE assessments.property_id = properties.id AND assessments.year = $1
        )
      `, [currentYear]);

      // Drop old columns from properties
      await pool.query(`ALTER TABLE properties DROP COLUMN IF EXISTS appraised_value`);
      await pool.query(`ALTER TABLE properties DROP COLUMN IF EXISTS annual_tax`);
      await pool.query(`ALTER TABLE properties DROP COLUMN IF EXISTS status`);
    } catch (error) {
      console.log('Assessment migration completed or already applied');
    }

    // Migration: Convert bathrooms to DECIMAL and merge half_bathrooms
    const bathroomMigrations = [
      // Add new bathrooms_decimal column
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS bathrooms_decimal DECIMAL(3, 1)`,
      // Migrate data: combine bathrooms + (half_bathrooms * 0.5)
      `UPDATE properties SET bathrooms_decimal = COALESCE(bathrooms, 0) + COALESCE(half_bathrooms, 0) * 0.5 WHERE bathrooms_decimal IS NULL AND (bathrooms IS NOT NULL OR half_bathrooms IS NOT NULL)`,
      // Drop old columns
      `ALTER TABLE properties DROP COLUMN IF EXISTS bathrooms`,
      `ALTER TABLE properties DROP COLUMN IF EXISTS half_bathrooms`,
      // Rename new column to bathrooms
      `ALTER TABLE properties RENAME COLUMN bathrooms_decimal TO bathrooms`
    ];

    for (const migration of bathroomMigrations) {
      try {
        await pool.query(migration);
      } catch (error) {
        // Ignore errors if column already migrated
        console.log('Migration step completed or already applied');
      }
    }

    // Migration: Add estimated values and report URL to assessments table
    const assessmentMigrations = [
      `ALTER TABLE assessments ADD COLUMN IF NOT EXISTS estimated_appraised_value DECIMAL(15, 2)`,
      `ALTER TABLE assessments ADD COLUMN IF NOT EXISTS estimated_annual_tax DECIMAL(15, 2)`,
      `ALTER TABLE assessments ADD COLUMN IF NOT EXISTS report_url VARCHAR(500)`
    ];

    for (const migration of assessmentMigrations) {
      try {
        await pool.query(migration);
      } catch (error) {
        // Ignore errors if column already exists
        console.log('Assessment migration step completed or already applied');
      }
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}
