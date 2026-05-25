const request = require('supertest');
const crypto = require('crypto');
require('./helpers/aspektMock');

const makeApp = require('./helpers/app');
const { resetDb, closeDb } = require('./helpers/db');
const { createUserWithToken, bearer } = require('./helpers/auth');

let app;
let staff;

beforeAll(() => { app = makeApp(); });
beforeEach(async () => {
  await resetDb();
  staff = await createUserWithToken({ email: 's@test.com' });
});
afterAll(async () => { await closeDb(); });

// Mirror server/services/paymentService.calculateHashV3 so tests can sign
// payloads exactly the way the gateway would.
function signParams(params, storeKey) {
  const escape = (v) => String(v).replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
  const keys = Object.keys(params)
    .filter(k => k.toLowerCase() !== 'hash' && k.toLowerCase() !== 'encoding')
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const plaintext = keys.map(k => escape(params[k])).join('|') + '|' + escape(storeKey);
  return crypto.createHash('sha512').update(plaintext, 'utf8').digest('base64');
}

describe('GET /api/payment/start', () => {
  test('401 without token', async () => {
    expect((await request(app).get('/api/payment/start?amount=10&orderId=O1')).status).toBe(401);
  });

  test('400 when params missing', async () => {
    expect((await request(app).get('/api/payment/start').set(bearer(staff.token))).status).toBe(400);
  });

  test('returns HTML form with HASH field', async () => {
    const res = await request(app).get('/api/payment/start?amount=10&orderId=O1').set(bearer(staff.token));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toMatch(/name="HASH"/);
    expect(res.text).toMatch(/Order #O1/);
  });
});

describe('POST /api/payment/response', () => {
  test('renders failure HTML when HASH missing', async () => {
    const res = await request(app).post('/api/payment/response')
      .type('form').send({ Response: 'Approved', oid: 'O1' });
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Security Alert/i);
  });

  test('renders failure HTML when HASH wrong', async () => {
    const res = await request(app).post('/api/payment/response')
      .type('form').send({ Response: 'Approved', oid: 'O1', HASH: 'wrong' });
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Security Alert/i);
  });

  test('renders success HTML when HASH valid + 3DS + approved', async () => {
    const params = { Response: 'Approved', oid: 'O1', ProcReturnCode: '00', mdStatus: '1' };
    const HASH = signParams(params, process.env.PAYMENT_STORE_KEY);
    const res = await request(app).post('/api/payment/response').type('form').send({ ...params, HASH });
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Payment Successful/i);
  });

  test('renders failure HTML when HASH valid but declined', async () => {
    const params = { Response: 'Declined', oid: 'O1', ProcReturnCode: '99', mdStatus: '1' };
    const HASH = signParams(params, process.env.PAYMENT_STORE_KEY);
    const res = await request(app).post('/api/payment/response').type('form').send({ ...params, HASH });
    expect(res.text).toMatch(/Payment Failed/i);
  });
});

describe('POST /api/payment/callback', () => {
  test('400 HASH_MISMATCH for empty body', async () => {
    const res = await request(app).post('/api/payment/callback').type('form').send('');
    expect(res.status).toBe(400);
    expect(res.text).toBe('HASH_MISMATCH');
  });

  test('400 for wrong HASH', async () => {
    const res = await request(app).post('/api/payment/callback').type('form').send({ oid: 'O1', HASH: 'bad' });
    expect(res.status).toBe(400);
  });

  test('200 OK for valid signed APPROVED callback', async () => {
    const params = { Response: 'Approved', oid: 'O1', ProcReturnCode: '00', mdStatus: '1' };
    const HASH = signParams(params, process.env.PAYMENT_STORE_KEY);
    const res = await request(app).post('/api/payment/callback').type('form').send({ ...params, HASH });
    expect(res.status).toBe(200);
    expect(res.text).toBe('OK');
  });

  test('200 OK for valid signed FAILED callback (signature ok = ack)', async () => {
    const params = { Response: 'Declined', oid: 'O1', ProcReturnCode: '99', mdStatus: '1' };
    const HASH = signParams(params, process.env.PAYMENT_STORE_KEY);
    const res = await request(app).post('/api/payment/callback').type('form').send({ ...params, HASH });
    expect(res.status).toBe(200);
  });
});
