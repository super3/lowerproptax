exports.up = (pgm) => {
  pgm.addColumn('properties', {
    tax_record_url: { type: 'text' }
  }, { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropColumn('properties', 'tax_record_url', { ifExists: true });
};
