/**
 * Create direct mail campaign tables: campaigns + mail_recipients
 */

exports.up = (pgm) => {
  // Campaigns table
  pgm.createTable('campaigns', {
    id: { type: 'varchar(255)', primaryKey: true },
    name: { type: 'varchar(255)', notNull: true },
    county: { type: 'varchar(100)' },
    state: { type: 'varchar(50)' },
    deadline: { type: 'date' },
    created_at: { type: 'timestamp', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamp', default: pgm.func('NOW()') }
  }, { ifNotExists: true });

  // Mail recipients table
  pgm.createTable('mail_recipients', {
    id: { type: 'varchar(255)', primaryKey: true },
    campaign_id: {
      type: 'varchar(255)',
      notNull: true,
      references: 'campaigns',
      onDelete: 'CASCADE'
    },
    short_code: { type: 'varchar(20)', notNull: true, unique: true },
    recipient_name: { type: 'varchar(255)', notNull: true },
    address: { type: 'varchar(500)', notNull: true },
    city: { type: 'varchar(255)' },
    state: { type: 'varchar(100)' },
    zip_code: { type: 'varchar(20)' },
    sqft: { type: 'integer' },
    annual_tax: { type: 'decimal(15, 2)' },
    estimated_savings: { type: 'decimal(15, 2)' },
    comparables: { type: 'jsonb' },
    report_url: { type: 'varchar(500)' },
    email: { type: 'varchar(255)' },
    payment_status: { type: 'varchar(50)', default: "'unpaid'", notNull: true },
    stripe_session_id: { type: 'varchar(255)' },
    paid_at: { type: 'timestamp' },
    page_views: { type: 'integer', default: 0, notNull: true },
    last_viewed_at: { type: 'timestamp' },
    created_at: { type: 'timestamp', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamp', default: pgm.func('NOW()') }
  }, { ifNotExists: true });

  pgm.createIndex('mail_recipients', 'short_code', { ifNotExists: true });
  pgm.createIndex('mail_recipients', 'campaign_id', { ifNotExists: true });
  pgm.createIndex('mail_recipients', 'payment_status', { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropTable('mail_recipients', { ifExists: true });
  pgm.dropTable('campaigns', { ifExists: true });
};
