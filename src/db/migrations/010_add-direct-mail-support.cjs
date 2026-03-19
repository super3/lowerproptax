/**
 * Add direct mail support: referral codes, comparable properties, visit tracking
 */

exports.up = (pgm) => {
  // Add referral_code to properties and make user_id nullable
  pgm.alterColumn('properties', 'user_id', { notNull: false });
  pgm.addColumns('properties', {
    referral_code: { type: 'varchar(20)', unique: true },
    owner_name: { type: 'varchar(255)' },
    mailed_at: { type: 'timestamp' },
    source: { type: 'varchar(50)', default: "'website'" }
  }, { ifNotExists: true });
  pgm.createIndex('properties', 'referral_code', { ifNotExists: true });
  pgm.createIndex('properties', 'source', { ifNotExists: true });

  // Comparable properties shown in the mailer
  pgm.createTable('comparable_properties', {
    id: { type: 'serial', primaryKey: true },
    property_id: {
      type: 'varchar(255)',
      notNull: true,
      references: 'properties',
      onDelete: 'CASCADE'
    },
    address: { type: 'varchar(500)', notNull: true },
    sqft: { type: 'integer' },
    property_tax: { type: 'decimal(15, 2)' },
    created_at: { type: 'timestamp', default: pgm.func('NOW()') }
  }, { ifNotExists: true });
  pgm.createIndex('comparable_properties', 'property_id', { ifNotExists: true });

  // Track visits to referral URLs
  pgm.createTable('referral_visits', {
    id: { type: 'serial', primaryKey: true },
    property_id: {
      type: 'varchar(255)',
      notNull: true,
      references: 'properties',
      onDelete: 'CASCADE'
    },
    referral_code: { type: 'varchar(20)', notNull: true },
    ip_address: { type: 'varchar(45)' },
    user_agent: { type: 'text' },
    visited_at: { type: 'timestamp', default: pgm.func('NOW()') }
  }, { ifNotExists: true });
  pgm.createIndex('referral_visits', 'property_id', { ifNotExists: true });
  pgm.createIndex('referral_visits', 'referral_code', { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropTable('referral_visits', { ifExists: true });
  pgm.dropTable('comparable_properties', { ifExists: true });
  pgm.dropColumns('properties', ['referral_code', 'owner_name', 'mailed_at', 'source']);
  pgm.alterColumn('properties', 'user_id', { notNull: true });
};
