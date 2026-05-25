const request = require('supertest');
const path = require('path');
const { setAspektResponse, resetAspektMock } = require('./helpers/aspektMock');

const makeApp = require('./helpers/app');
const { resetDb, closeDb } = require('./helpers/db');
const { createUserWithToken, bearer } = require('./helpers/auth');

let app;
let staff;
const PNG = path.resolve(__dirname, 'fixtures', 'tiny.png');

beforeAll(() => { app = makeApp(); });
beforeEach(async () => {
  await resetDb();
  resetAspektMock();
  staff = await createUserWithToken({ email: 's@test.com' });
});
afterAll(async () => { await closeDb(); });

describe('GET /api/contact/check', () => {
  test('401 without token', async () => {
    expect((await request(app).get('/api/contact/check?personalNumber=1')).status).toBe(401);
  });

  test('400 without personalNumber', async () => {
    expect((await request(app).get('/api/contact/check').set(bearer(staff.token))).status).toBe(400);
  });

  test('exists=true when Aspekt returns a contact', async () => {
    setAspektResponse('GET', '/api/getContact/', {
      status: 200,
      data: {
        Body: [{ ContactCode: 'CC-1', FirstName: 'E', LastName: 'R', PersonalNumber: '1', BirthDate: '01.01.1990', Address: 'x', Mobile: '0' }],
      },
    });
    const res = await request(app).get('/api/contact/check?personalNumber=1').set(bearer(staff.token));
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(true);
    expect(res.body.contact.ContactCode).toBe('CC-1');
  });

  test('exists=false when Aspekt returns empty body', async () => {
    setAspektResponse('GET', '/api/getContact/', { status: 200, data: { Body: [] } });
    const res = await request(app).get('/api/contact/check?personalNumber=1').set(bearer(staff.token));
    expect(res.body.exists).toBe(false);
  });
});

describe('POST /api/contact/filter', () => {
  test('400 when Filters missing or empty', async () => {
    expect((await request(app).post('/api/contact/filter').set(bearer(staff.token)).send({})).status).toBe(400);
    expect((await request(app).post('/api/contact/filter').set(bearer(staff.token)).send({ Filters: [] })).status).toBe(400);
  });

  test('400 for invalid filter type', async () => {
    const res = await request(app).post('/api/contact/filter').set(bearer(staff.token)).send({ Filters: [{ Type: 'X', Value: 'y' }] });
    expect(res.status).toBe(400);
  });

  test('400 when filter missing Type or Value', async () => {
    expect((await request(app).post('/api/contact/filter').set(bearer(staff.token)).send({ Filters: [{ Type: 'CODE' }] })).status).toBe(400);
  });

  test('200 with mapped contact', async () => {
    setAspektResponse('GET', '/api/getContactByFilter/', {
      status: 200,
      data: { Code: 200, Body: { ContactId: 1, ContactCode: 'CC-1', FirstName: 'E', LastName: 'R', PersonalNumber: '1', Address: 'x', Mobile: '0', BirthDate: '01.01.1990' } },
    });
    const res = await request(app).post('/api/contact/filter').set(bearer(staff.token)).send({ Filters: [{ Type: 'PERSONALNUMBER', Value: '1' }] });
    expect(res.status).toBe(200);
    expect(res.body.contact.firstName).toBe('E');
  });

  test('maps Code 402 (no person) to 404', async () => {
    setAspektResponse('GET', '/api/getContactByFilter/', { status: 200, data: { Code: 402, Msg: 'Person not found' } });
    const res = await request(app).post('/api/contact/filter').set(bearer(staff.token)).send({ Filters: [{ Type: 'PERSONALNUMBER', Value: '1' }] });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/contact/register', () => {
  test('400 missing required field', async () => {
    const res = await request(app).post('/api/contact/register').set(bearer(staff.token)).field('firstName', 'A');
    expect(res.status).toBe(400);
  });

  test('400 invalid mobile', async () => {
    const res = await request(app).post('/api/contact/register').set(bearer(staff.token))
      .field('firstName', 'A').field('lastName', 'B').field('personalNumber', 'P')
      .field('birthDate', '01.01.1990').field('address', 'X').field('mobile', 'not-a-number');
    expect(res.status).toBe(400);
  });

  test('400 invalid birth date format', async () => {
    const res = await request(app).post('/api/contact/register').set(bearer(staff.token))
      .field('firstName', 'A').field('lastName', 'B').field('personalNumber', 'P')
      .field('birthDate', 'tomorrow').field('address', 'X').field('mobile', '123');
    expect(res.status).toBe(400);
  });

  test('returns existing user when alias already known to Aspekt', async () => {
    setAspektResponse('GET', '/api/getContact/', {
      status: 200,
      data: { Body: [{ ContactCode: 'CC-1', FirstName: 'E', LastName: 'R', PersonalNumber: '1', BirthDate: '01.01.1990', Address: 'x', Mobile: '123' }] },
    });
    const res = await request(app).post('/api/contact/register').set(bearer(staff.token))
      .field('firstName', 'E').field('lastName', 'R').field('personalNumber', '1')
      .field('birthDate', '01.01.1990').field('address', 'x').field('mobile', '123');
    expect(res.status).toBe(200);
    expect(res.body.userExists).toBe(true);
  });

  test('creates a subscription for a new alias', async () => {
    setAspektResponse('GET', '/api/getContact/', { status: 200, data: { Body: [] } });
    setAspektResponse('POST', '/api/createSubscription/', { status: 200, data: { Code: 200 } });
    const res = await request(app).post('/api/contact/register').set(bearer(staff.token))
      .field('firstName', 'A').field('lastName', 'B').field('personalNumber', 'P')
      .field('birthDate', '01.01.1990').field('address', 'X').field('mobile', '123');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('pending');
  });

  test('does not 500 when called with no body at all', async () => {
    const res = await request(app).post('/api/contact/register').set(bearer(staff.token));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/contact/subscription-status', () => {
  test('400 without id', async () => {
    expect((await request(app).get('/api/contact/subscription-status').set(bearer(staff.token))).status).toBe(400);
  });

  test('404 when Code 440', async () => {
    setAspektResponse('GET', '/api/checkSubscription/', { status: 200, data: { Code: 440 } });
    const res = await request(app).get('/api/contact/subscription-status?subscriptionId=x').set(bearer(staff.token));
    expect(res.status).toBe(404);
  });

  test('approved status maps to {status:"approved", contactCode}', async () => {
    setAspektResponse('GET', '/api/checkSubscription/', { status: 200, data: { Body: { Status: 'Approved', ContactCode: 'CC-1' } } });
    const res = await request(app).get('/api/contact/subscription-status?subscriptionId=x').set(bearer(staff.token));
    expect(res.body).toEqual({ status: 'approved', contactCode: 'CC-1' });
  });

  test('rejected status carries reason', async () => {
    setAspektResponse('GET', '/api/checkSubscription/', { status: 200, data: { Body: { Status: 'Rejected', Note: 'KO' } } });
    const res = await request(app).get('/api/contact/subscription-status?subscriptionId=x').set(bearer(staff.token));
    expect(res.body).toEqual({ status: 'rejected', reason: 'KO' });
  });
});

describe('POST /api/contact/upload (file filter)', () => {
  test('200 with a PNG', async () => {
    const res = await request(app).post('/api/contact/upload').set(bearer(staff.token)).attach('file', PNG);
    expect(res.status).toBe(200);
    expect(res.body.file.mimetype).toBe('image/png');
  });

  test('400 with a .txt (unsupported type)', async () => {
    const res = await request(app).post('/api/contact/upload').set(bearer(staff.token))
      .attach('file', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unsupported file type/);
  });

  test('400 when no file attached', async () => {
    const res = await request(app).post('/api/contact/upload').set(bearer(staff.token));
    expect(res.status).toBe(400);
  });
});

describe('test endpoints', () => {
  test('test-create-contact proxies Aspekt', async () => {
    setAspektResponse('POST', '/api/createContact/', { status: 200, data: { Code: 200, Msg: 'OK' } });
    const res = await request(app).post('/api/contact/test-create-contact').set(bearer(staff.token));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('test-get-offices returns data array', async () => {
    setAspektResponse('GET', '/api/getAllOffices/', { status: 200, data: { Body: [{ OfficeCode: '10' }] } });
    const res = await request(app).get('/api/contact/test-get-offices').set(bearer(staff.token));
    expect(res.body.data).toHaveLength(1);
  });

  test('test-get-places returns data array', async () => {
    setAspektResponse('GET', '/api/getAllPlaces/', { status: 200, data: { Body: [{ PlaceCode: '20000' }] } });
    const res = await request(app).get('/api/contact/test-get-places').set(bearer(staff.token));
    expect(res.body.data).toHaveLength(1);
  });

  test('test-get-system-ids returns data', async () => {
    setAspektResponse('GET', '/api/getContactSystemIds/', { status: 200, data: { Body: { Educations: [] } } });
    const res = await request(app).get('/api/contact/test-get-system-ids').set(bearer(staff.token));
    expect(res.body.success).toBe(true);
  });

  test('test-get-officers returns 500 when Aspekt rejects', async () => {
    setAspektResponse('GET', '/api/getOfficersByOfficeCode/', () => { throw Object.assign(new Error('nope'), { response: { status: 404 } }); });
    const res = await request(app).get('/api/contact/test-get-officers/01').set(bearer(staff.token));
    expect(res.status).toBe(500);
  });

  test('test-update-contact, test-subscriptions-on-date, test-create-subscription proxy through', async () => {
    setAspektResponse('POST', '/api/updateContact/', { status: 200, data: { Code: 402 } });
    setAspektResponse('GET', '/api/getAllSubscriptionsOnDate/', { status: 200, data: { Code: 900 } });
    setAspektResponse('POST', '/api/createSubscription/', { status: 200, data: { Code: 200 } });
    expect((await request(app).post('/api/contact/test-update-contact').set(bearer(staff.token))).status).toBe(200);
    expect((await request(app).post('/api/contact/test-subscriptions-on-date').set(bearer(staff.token))).status).toBe(200);
    expect((await request(app).post('/api/contact/test-create-subscription').set(bearer(staff.token))).status).toBe(200);
  });
});
