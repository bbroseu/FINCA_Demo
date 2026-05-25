const { execFileSync } = require('child_process');
const path = require('path');
const os = require('os');

const TEST_DB = 'finca_demo_test';

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { stdio: 'pipe', ...opts });
}

module.exports = async function globalSetup() {
  const host = process.env.PGHOST || 'localhost';
  const user = process.env.PGUSER || os.userInfo().username;

  // Best-effort drop; ignore "does not exist" errors.
  try {
    run('dropdb', ['-h', host, '-U', user, '--if-exists', TEST_DB]);
  } catch (_) {
    /* noop */
  }

  run('createdb', ['-h', host, '-U', user, TEST_DB]);

  const schemaPath = path.resolve(__dirname, '..', 'server', 'data', 'schema.sql');
  run('psql', ['-h', host, '-U', user, '-d', TEST_DB, '-v', 'ON_ERROR_STOP=1', '-q', '-f', schemaPath]);
};
