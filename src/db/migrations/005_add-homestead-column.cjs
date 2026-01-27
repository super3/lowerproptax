/**
 * Add homestead column to properties table
 * Tracks whether property has homestead exemption
 */

exports.up = (pgm) => {
  pgm.addColumn('properties', {
    homestead: { type: 'boolean' }
  }, { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropColumn('properties', 'homestead', { ifExists: true });
};
