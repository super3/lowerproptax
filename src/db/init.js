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
        status VARCHAR(50) DEFAULT 'preparing',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_properties_user_id ON properties(user_id);
    `;

    await pool.query(createPropertiesTable);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}
