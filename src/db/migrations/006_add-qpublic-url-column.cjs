/**
 * Add qpublic_url column to properties table
 * Stores the qpublic property page URL for verification
 */

exports.up = (pgm) => {
  pgm.addColumn('properties', {
    qpublic_url: { type: 'varchar(500)' }
  }, { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropColumn('properties', 'qpublic_url', { ifExists: true });
};
