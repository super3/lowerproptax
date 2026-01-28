/**
 * Add parcel_number column to properties table
 * Stores the county parcel ID for direct tax lookup
 */

exports.up = (pgm) => {
  pgm.addColumn('properties', {
    parcel_number: { type: 'varchar(100)' }
  }, { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropColumn('properties', 'parcel_number', { ifExists: true });
};
