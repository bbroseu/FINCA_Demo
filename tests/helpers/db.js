const db = require('../../server/utils/db');

// Order matters: child tables before parents to satisfy FKs.
const TABLES = [
  'scorm_tracking',
  'scorm_package_files',
  'scorm_packages',
  'courses',
  'lead_ddc',
  'lead_products',
  'leads',
  'loan_applications',
  'user_images',
  'users',
  'auth_users',
];

async function resetDb() {
  await db.query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}

async function closeDb() {
  await db.pool.end();
}

module.exports = { resetDb, closeDb, db };
