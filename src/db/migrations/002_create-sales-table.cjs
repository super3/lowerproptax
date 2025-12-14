/**
 * Create sales table for property sales data
 * Used for finding comparable sales (comps)
 */

exports.up = (pgm) => {
  pgm.createTable('sales', {
    // Primary key
    id: { type: 'serial', primaryKey: true },

    // Identification
    parcel_id: { type: 'varchar(50)', notNull: true },
    address: { type: 'varchar(500)' },
    county: { type: 'varchar(100)', notNull: true },
    state: { type: 'varchar(2)', notNull: true },
    lat: { type: 'decimal(10, 8)' },
    lng: { type: 'decimal(11, 8)' },

    // Sale info
    sale_date: { type: 'date' },
    sale_price: { type: 'decimal(15, 2)' },
    valid_comp: { type: 'boolean' },

    // Property characteristics
    bedrooms: { type: 'integer' },
    bathrooms: { type: 'decimal(3, 1)' },
    square_ft: { type: 'integer' },
    year_built: { type: 'integer' },
    stories: { type: 'integer' },
    acres: { type: 'decimal(10, 4)' },

    // Classification
    property_class: { type: 'varchar(20)' },
    style: { type: 'varchar(50)' },

    // Metadata
    created_at: { type: 'timestamp', default: pgm.func('NOW()') }
  }, { ifNotExists: true });

  // Indexes for comp searches
  pgm.createIndex('sales', 'county', { ifNotExists: true });
  pgm.createIndex('sales', 'state', { ifNotExists: true });
  pgm.createIndex('sales', 'sale_date', { ifNotExists: true });
  pgm.createIndex('sales', 'sale_price', { ifNotExists: true });
  pgm.createIndex('sales', 'valid_comp', { ifNotExists: true });
  pgm.createIndex('sales', 'square_ft', { ifNotExists: true });
  pgm.createIndex('sales', ['lat', 'lng'], { ifNotExists: true });

  // Unique constraint on parcel_id + sale_date to prevent duplicates
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_parcel_sale'
      ) THEN
        ALTER TABLE sales ADD CONSTRAINT unique_parcel_sale UNIQUE (parcel_id, sale_date);
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('sales', { ifExists: true });
};
