exports.up = (pgm) => {
  pgm.createTable('scrape_cache', {
    id: { type: 'varchar(255)', primaryKey: true },
    address: { type: 'varchar(500)', notNull: true },
    county: { type: 'varchar(100)' },
    bedrooms: { type: 'integer' },
    bathrooms: { type: 'decimal(3, 1)' },
    sqft: { type: 'integer' },
    homestead: { type: 'boolean' },
    parcel_number: { type: 'varchar(100)' },
    qpublic_url: { type: 'varchar(500)' },
    property_tax_2025: { type: 'varchar(50)' },
    tax_record_url: { type: 'text' },
    created_at: { type: 'timestamp', default: pgm.func('NOW()') },
    expires_at: { type: 'timestamp' }
  }, { ifNotExists: true });

  pgm.createIndex('scrape_cache', 'address', { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropTable('scrape_cache', { ifExists: true });
};
