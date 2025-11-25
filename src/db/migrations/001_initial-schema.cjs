/**
 * Initial database schema migration
 * Creates properties and assessments tables
 */

exports.up = (pgm) => {
  // Create properties table
  pgm.createTable('properties', {
    id: { type: 'varchar(255)', primaryKey: true },
    user_id: { type: 'varchar(255)', notNull: true },
    address: { type: 'varchar(500)', notNull: true },
    city: { type: 'varchar(255)' },
    state: { type: 'varchar(100)' },
    zip_code: { type: 'varchar(20)' },
    country: { type: 'varchar(100)' },
    lat: { type: 'decimal(10, 8)' },
    lng: { type: 'decimal(11, 8)' },
    bedrooms: { type: 'integer' },
    bathrooms: { type: 'decimal(3, 1)' },
    sqft: { type: 'integer' },
    created_at: { type: 'timestamp', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamp', default: pgm.func('NOW()') }
  });

  pgm.createIndex('properties', 'user_id');

  // Create assessments table
  pgm.createTable('assessments', {
    id: { type: 'varchar(255)', primaryKey: true },
    property_id: {
      type: 'varchar(255)',
      notNull: true,
      references: 'properties',
      onDelete: 'CASCADE'
    },
    year: { type: 'integer', notNull: true },
    appraised_value: { type: 'decimal(15, 2)' },
    annual_tax: { type: 'decimal(15, 2)' },
    estimated_appraised_value: { type: 'decimal(15, 2)' },
    estimated_annual_tax: { type: 'decimal(15, 2)' },
    report_url: { type: 'varchar(500)' },
    status: { type: 'varchar(50)', default: 'preparing' },
    created_at: { type: 'timestamp', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamp', default: pgm.func('NOW()') }
  });

  pgm.createIndex('assessments', 'property_id');
  pgm.createIndex('assessments', 'year');
  pgm.addConstraint('assessments', 'unique_property_year', {
    unique: ['property_id', 'year']
  });
};

exports.down = (pgm) => {
  pgm.dropTable('assessments');
  pgm.dropTable('properties');
};
