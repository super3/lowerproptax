/**
 * Drop appraised_value and estimated_appraised_value columns
 * These are no longer needed after pivot to homestead exemption checking
 */

exports.up = (pgm) => {
  pgm.dropColumn('assessments', 'appraised_value', { ifExists: true });
  pgm.dropColumn('assessments', 'estimated_appraised_value', { ifExists: true });
};

exports.down = (pgm) => {
  // Recreate the columns if we need to roll back
  pgm.addColumn('assessments', {
    appraised_value: { type: 'decimal(15, 2)' }
  });
  pgm.addColumn('assessments', {
    estimated_appraised_value: { type: 'decimal(15, 2)' }
  });
};
