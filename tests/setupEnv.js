// Runs before every test file is loaded — set env so utils/db.js connects to
// the test database, and so other modules pick up deterministic config.
process.env.NODE_ENV = 'test';
process.env.PGHOST = process.env.PGHOST || 'localhost';
process.env.PGUSER = process.env.PGUSER || require('os').userInfo().username;
process.env.PGDATABASE = 'finca_demo_test';

process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod';
process.env.JWT_EXPIRES_IN = '1h';

process.env.API_BASE_URL = 'http://aspekt.invalid';
process.env.MERCHANT_USERNAME = 'test';
process.env.MERCHANT_API_KEY = 'test';

process.env.PAYMENT_CLIENT_ID = '530000082';
process.env.PAYMENT_STORE_KEY = 'TEST_STORE_KEY';
process.env.PAYMENT_GATE_URL = 'https://example.invalid/gate';
process.env.PAYMENT_OK_URL = 'http://localhost:3000/api/payment/response';
process.env.PAYMENT_FAIL_URL = 'http://localhost:3000/api/payment/response';
process.env.PAYMENT_CALLBACK_URL = 'http://localhost:3000/api/payment/callback';
