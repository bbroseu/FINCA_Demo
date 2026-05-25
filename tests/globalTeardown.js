const { execFileSync } = require('child_process');
const os = require('os');

const TEST_DB = 'finca_demo_test';

module.exports = async function globalTeardown() {
  const host = process.env.PGHOST || 'localhost';
  const user = process.env.PGUSER || os.userInfo().username;
  try {
    execFileSync('dropdb', ['-h', host, '-U', user, '--if-exists', TEST_DB], { stdio: 'pipe' });
  } catch (_) {
    /* noop */
  }
};
