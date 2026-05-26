const request = require('supertest');
const { setAspektResponse, resetAspektMock } = require('./helpers/aspektMock');

const makeApp = require('./helpers/app');
const { resetDb, closeDb } = require('./helpers/db');
const { createUserWithToken, createCustomerWithToken, bearer } = require('./helpers/auth');

let app;
let staff, admin, otherStaff;
let customer, otherCustomer;

beforeAll(() => { app = makeApp(); });
beforeEach(async () => {
  await resetDb();
  resetAspektMock();
  staff = await createUserWithToken({ email: 's@test.com' });
  admin = await createUserWithToken({ email: 'a@test.com', role: 'admin' });
  otherStaff = await createUserWithToken({ email: 'o@test.com' });
  customer = await createCustomerWithToken({ email: 'cust@test.com' });
  otherCustomer = await createCustomerWithToken({ email: 'other@test.com' });
});
afterAll(async () => { await closeDb(); });

const VALID_LEAD = {
  PersonalNumber: '1403990450033',
  Name: 'Test Lead',
  Mobile: '38971234567',
  Email: 'lead@test.com',
  PlaceCode: '20000',
  LeadSourceCode: 'MOB',
  InterestedInProducts: [{ ProductCode: '04-05' }],
  LoanAmount: 1000,
  Priority: 'Normal',
};

async function createLead(token, overrides = {}, aspektOverrides = {}) {
  setAspektResponse('POST', '/api/createLead/', {
    status: 200,
    data: { Code: 200, Body: { LeadNumber: '135669/26', LeadId: 1111366, ...aspektOverrides } },
  });
  return request(app).post('/api/lead/create').set(bearer(token)).send({ ...VALID_LEAD, ...overrides });
}

describe('GET /api/lead/ (root help)', () => {
  test('returns endpoint listing for authed user', async () => {
    const res = await request(app).get('/api/lead/').set(bearer(staff.token));
    expect(res.status).toBe(200);
    expect(res.body.endpoints).toBeDefined();
  });
});

describe('GET reference endpoints', () => {
  test('products', async () => {
    setAspektResponse('GET', '/api/getProducts/', { status: 200, data: { Body: { Products: [{ Product: 'X' }] } } });
    const res = await request(app).get('/api/lead/products/123').set(bearer(staff.token));
    expect(res.body.data).toEqual([{ Product: 'X' }]);
  });

  test('products-with-levels', async () => {
    setAspektResponse('GET', '/api/getProductsWithLevels/', { status: 200, data: { Body: { Products: [] } } });
    expect((await request(app).get('/api/lead/products-with-levels/1').set(bearer(staff.token))).status).toBe(200);
  });

  test('loan-purposes 200 + 404 branches', async () => {
    setAspektResponse('GET', '/api/getLoanPurposes/', { status: 200, data: { Body: [{ id: 1 }] } });
    expect((await request(app).get('/api/lead/loan-purposes/04-05').set(bearer(staff.token))).status).toBe(200);
    resetAspektMock();
    setAspektResponse('GET', '/api/getLoanPurposes/', { status: 400, data: { Code: 504, Msg: 'not found' } });
    expect((await request(app).get('/api/lead/loan-purposes/04-05').set(bearer(staff.token))).status).toBe(404);
  });

  test('business-types 200 + 404 branches', async () => {
    setAspektResponse('GET', '/api/getBusinessTypes/', { status: 200, data: { Body: [] } });
    expect((await request(app).get('/api/lead/business-types/04-05').set(bearer(staff.token))).status).toBe(200);
    resetAspektMock();
    setAspektResponse('GET', '/api/getBusinessTypes/', { status: 400, data: { Code: 503 } });
    expect((await request(app).get('/api/lead/business-types/04-05').set(bearer(staff.token))).status).toBe(404);
  });

  test('offices / places / sources', async () => {
    setAspektResponse('GET', '/api/getAllOffices/', { status: 200, data: { Body: [{ OfficeCode: '10' }] } });
    setAspektResponse('GET', '/api/getAllPlaces/', { status: 200, data: { Body: [{ PlaceCode: '20000' }] } });
    setAspektResponse('GET', '/api/getAllLeadSources/', { status: 200, data: { Body: [{ LeadSourceCode: '01', LeadSourceName: 'Print' }] } });
    expect((await request(app).get('/api/lead/offices').set(bearer(staff.token))).body.data).toHaveLength(1);
    expect((await request(app).get('/api/lead/places').set(bearer(staff.token))).body.data).toHaveLength(1);
    expect((await request(app).get('/api/lead/sources').set(bearer(staff.token))).body.data).toHaveLength(1);
  });
});

describe('GET /api/lead/mobile-lead-source', () => {
  test('returns code when source matches mobile keyword', async () => {
    setAspektResponse('GET', '/api/getAllLeadSources/', { status: 200, data: { Body: [{ LeadSourceCode: 'MOB', LeadSourceName: 'Mobile App' }] } });
    const res = await request(app).get('/api/lead/mobile-lead-source').set(bearer(staff.token));
    expect(res.body.data.leadSourceCode).toBe('MOB');
  });
  test('404 when no match', async () => {
    setAspektResponse('GET', '/api/getAllLeadSources/', { status: 200, data: { Body: [{ LeadSourceCode: '01', LeadSourceName: 'Print' }] } });
    const res = await request(app).get('/api/lead/mobile-lead-source').set(bearer(staff.token));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/lead/check-status', () => {
  test('400 without LeadNumber', async () => {
    expect((await request(app).post('/api/lead/check-status').set(bearer(staff.token)).send({})).status).toBe(400);
  });

  test('200 with body', async () => {
    setAspektResponse('POST', '/api/checkLeadStatus/', { status: 200, data: { Code: 200, Body: { Status: 'Active' } } });
    const res = await request(app).post('/api/lead/check-status').set(bearer(staff.token)).send({ LeadNumber: '1/1' });
    expect(res.status).toBe(200);
  });

  test('404 when Code 404', async () => {
    setAspektResponse('POST', '/api/checkLeadStatus/', { status: 200, data: { Code: 404 } });
    const res = await request(app).post('/api/lead/check-status').set(bearer(staff.token)).send({ LeadNumber: '1/1' });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/lead/create', () => {
  test('400 with no body / missing fields', async () => {
    const res = await request(app).post('/api/lead/create').set(bearer(staff.token)).send({});
    expect(res.status).toBe(400);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  test('creates lead and persists it locally', async () => {
    const res = await createLead(staff.token);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ leadNumber: '135669/26', leadId: 1111366, message: 'Lead created successfully' });

    // Verify it lives in /mine
    const mine = await request(app).get('/api/lead/mine').set(bearer(staff.token));
    expect(mine.body.items).toHaveLength(1);
    expect(mine.body.items[0].lead_id).toBe('1111366');
  });

  test('maps Aspekt Code 402 → 404', async () => {
    setAspektResponse('POST', '/api/createLead/', { status: 200, data: { Code: 402, Msg: 'no person' } });
    const res = await request(app).post('/api/lead/create').set(bearer(staff.token)).send(VALID_LEAD);
    expect(res.status).toBe(404);
  });
});

describe('listing endpoints', () => {
  test('GET /all is admin-only', async () => {
    expect((await request(app).get('/api/lead/all').set(bearer(staff.token))).status).toBe(403);
    expect((await request(app).get('/api/lead/all').set(bearer(admin.token))).status).toBe(200);
  });

  test('GET /mine returns only the caller’s leads', async () => {
    await createLead(staff.token);
    await createLead(otherStaff.token, {}, { LeadId: 9999, LeadNumber: '9999/26' });

    const mine = await request(app).get('/api/lead/mine').set(bearer(staff.token));
    expect(mine.body.items).toHaveLength(1);
    expect(mine.body.items[0].created_by_auth_user_id).toBe(staff.user.id);
  });

  test('GET /by-user/:alias admin-only', async () => {
    await createLead(staff.token);
    expect((await request(app).get('/api/lead/by-user/1403990450033').set(bearer(staff.token))).status).toBe(403);
    const res = await request(app).get('/api/lead/by-user/1403990450033').set(bearer(admin.token));
    expect(res.body.items).toHaveLength(1);
  });

  test('GET /user-profile/:alias merges contact + local leads', async () => {
    setAspektResponse('GET', '/api/getContact/', {
      status: 200,
      data: { Body: [{ ContactCode: 'CC-1', FirstName: 'E' }] },
    });
    await createLead(staff.token);
    const res = await request(app).get('/api/lead/user-profile/1403990450033').set(bearer(staff.token));
    expect(res.body.contact.ContactCode).toBe('CC-1');
    expect(res.body.leads).toHaveLength(1);
  });
});

describe('GET /api/lead/:leadId', () => {
  test('404 when not found', async () => {
    const res = await request(app).get('/api/lead/9999999').set(bearer(admin.token));
    expect(res.status).toBe(404);
  });

  test('owner can fetch their own lead, enriched with Aspekt status', async () => {
    await createLead(staff.token);
    setAspektResponse('POST', '/api/checkLeadStatus/', {
      status: 200,
      data: { Code: 200, Body: { LeadNumber: '135669/26', Status: 'Active', StatusCode: 'A' } },
    });
    const res = await request(app).get('/api/lead/1111366').set(bearer(staff.token));
    expect(res.status).toBe(200);
    expect(res.body.data.aspekt.status).toBe('Active');
  });

  test('non-owner staff -> 403', async () => {
    await createLead(staff.token);
    setAspektResponse('POST', '/api/checkLeadStatus/', { status: 200, data: { Code: 200, Body: {} } });
    const res = await request(app).get('/api/lead/1111366').set(bearer(otherStaff.token));
    expect(res.status).toBe(403);
  });

  test('admin can fetch anyone’s lead', async () => {
    await createLead(staff.token);
    setAspektResponse('POST', '/api/checkLeadStatus/', { status: 200, data: { Code: 200, Body: {} } });
    const res = await request(app).get('/api/lead/1111366').set(bearer(admin.token));
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/lead/:leadId/status', () => {
  test('owner can update', async () => {
    await createLead(staff.token);
    const res = await request(app).patch('/api/lead/1111366/status').set(bearer(staff.token)).send({ status: 'Qualified' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Qualified');
  });

  test('non-owner staff -> 403', async () => {
    await createLead(staff.token);
    const res = await request(app).patch('/api/lead/1111366/status').set(bearer(otherStaff.token)).send({ status: 'Qualified' });
    expect(res.status).toBe(403);
  });

  test('admin can update someone else’s lead', async () => {
    await createLead(staff.token);
    const res = await request(app).patch('/api/lead/1111366/status').set(bearer(admin.token)).send({ status: 'Closed' });
    expect(res.status).toBe(200);
  });

  test('400 when status missing', async () => {
    await createLead(staff.token);
    expect((await request(app).patch('/api/lead/1111366/status').set(bearer(staff.token)).send({})).status).toBe(400);
  });

  test('404 when lead unknown', async () => {
    const res = await request(app).patch('/api/lead/9999999/status').set(bearer(admin.token)).send({ status: 'Closed' });
    expect(res.status).toBe(404);
  });
});

describe('Customer-initiated leads', () => {
  test('customer can create a lead; stored with created_by_contact_id and no auth-user id', async () => {
    const res = await createLead(customer.token);
    expect(res.status).toBe(200);
    expect(res.body.data.leadId).toBe(1111366);

    const mine = await request(app).get('/api/lead/mine').set(bearer(customer.token));
    expect(mine.body.items).toHaveLength(1);
    expect(mine.body.items[0].created_by_contact_id).toBe(customer.customer.contact_id);
    expect(mine.body.items[0].created_by_auth_user_id).toBeNull();
  });

  test('GET /mine isolates customers from each other and from staff', async () => {
    await createLead(customer.token);
    await createLead(otherCustomer.token, {}, { LeadId: 2222, LeadNumber: '2222/26' });
    await createLead(staff.token, {}, { LeadId: 3333, LeadNumber: '3333/26' });

    const mine = await request(app).get('/api/lead/mine').set(bearer(customer.token));
    expect(mine.body.items).toHaveLength(1);
    expect(mine.body.items[0].created_by_contact_id).toBe(customer.customer.contact_id);
  });

  test('admin /all includes customer-initiated leads', async () => {
    await createLead(customer.token);
    const all = await request(app).get('/api/lead/all').set(bearer(admin.token));
    expect(all.status).toBe(200);
    expect(all.body.items.some((r) => r.created_by_contact_id === customer.customer.contact_id)).toBe(true);
  });

  test('customer cannot read another customer\'s lead', async () => {
    await createLead(customer.token);
    setAspektResponse('POST', '/api/checkLeadStatus/', { status: 200, data: { Code: 200, Body: {} } });
    const res = await request(app).get('/api/lead/1111366').set(bearer(otherCustomer.token));
    expect(res.status).toBe(403);
  });

  test('admin can read and patch a customer-initiated lead', async () => {
    await createLead(customer.token);
    setAspektResponse('POST', '/api/checkLeadStatus/', { status: 200, data: { Code: 200, Body: {} } });
    expect((await request(app).get('/api/lead/1111366').set(bearer(admin.token))).status).toBe(200);
    expect((await request(app).patch('/api/lead/1111366/status').set(bearer(admin.token)).send({ status: 'Qualified' })).status).toBe(200);
  });

  test('staff (non-admin) cannot read a customer-initiated lead', async () => {
    await createLead(customer.token);
    setAspektResponse('POST', '/api/checkLeadStatus/', { status: 200, data: { Code: 200, Body: {} } });
    const res = await request(app).get('/api/lead/1111366').set(bearer(staff.token));
    expect(res.status).toBe(403);
  });
});
