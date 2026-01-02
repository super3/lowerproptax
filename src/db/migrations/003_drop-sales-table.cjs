/**
 * Drop sales table - no longer needed after pivot to savings discovery
 */

exports.up = (pgm) => {
  pgm.dropTable('sales', { ifExists: true });
};

exports.down = (pgm) => {
  // Recreate the sales table if we need to roll back
  pgm.createTable('sales', {
    id: { type: 'serial', primaryKey: true },
    parcel_id: { type: 'varchar(50)', notNull: true },
    address: { type: 'varchar(500)' },
    county: { type: 'varchar(100)', notNull: true },
    state: { type: 'varchar(2)', notNull: true },
    lat: { type: 'decimal(10, 8)' },
    lng: { type: 'decimal(11, 8)' },
    sale_date: { type: 'date' },
    sale_price: { type: 'decimal(15, 2)' },
    valid_comp: { type: 'boolean' },
    bedrooms: { type: 'integer' },
    bathrooms: { type: 'decimal(3, 1)' },
    square_ft: { type: 'integer' },
    year_built: { type: 'integer' },
    stories: { type: 'integer' },
    acres: { type: 'decimal(10, 4)' },
    property_class: { type: 'varchar(20)' },
    style: { type: 'varchar(50)' },
    created_at: { type: 'timestamp', default: pgm.func('NOW()') }
  }, { ifNotExists: true });
};
