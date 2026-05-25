const request = require('supertest');
require('./helpers/aspektMock');

const makeApp = require('./helpers/app');
const { resetDb, closeDb, db } = require('./helpers/db');
const { createUserWithToken, bearer } = require('./helpers/auth');

let app;
let admin, staff;

beforeAll(() => { app = makeApp(); });
beforeEach(async () => {
  await resetDb();
  admin = await createUserWithToken({ email: 'a@test.com', role: 'admin' });
  staff = await createUserWithToken({ email: 's@test.com' });
});
afterAll(async () => { await closeDb(); });

async function seedCustomer(overrides = {}) {
  const c = {
    contact_code: 'C-001',
    personal_number: '1403990450033',
    first_name: 'Emily',
    last_name: 'Robertson',
    birth_date: '1990-01-01',
    mobile: '38971000000',
    address: 'street 1',
    email: null,
    is_active: true,
    ...overrides,
  };
  const { rows } = await db.query(
    `INSERT INTO users (contact_code, personal_number, first_name, last_name, birth_date, mobile, address, email, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING contact_id`,
    [c.contact_code, c.personal_number, c.first_name, c.last_name, c.birth_date, c.mobile, c.address, c.email, c.is_active]
  );
  return rows[0].contact_id;
}

describe('GET /api/admin/customers', () => {
  test('401 without token', async () => {
    expect((await request(app).get('/api/admin/customers')).status).toBe(401);
  });

  test('403 for non-admin', async () => {
    const res = await request(app).get('/api/admin/customers').set(bearer(staff.token));
    expect(res.status).toBe(403);
  });

  test('returns paginated list with summary', async () => {
    await seedCustomer();
    await seedCustomer({ contact_code: 'C-002', personal_number: '2', first_name: 'John', is_active: false });
    const res = await request(app).get('/api/admin/customers').set(bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.summary).toEqual({ total: 2, active: 1, inactive: 1 });
  });

  test('filters by active=true', async () => {
    await seedCustomer();
    await seedCustomer({ contact_code: 'C-002', personal_number: '2', is_active: false });
    const res = await request(app).get('/api/admin/customers?active=true').set(bearer(admin.token));
    expect(res.body.items.every(i => i.is_active === true)).toBe(true);
  });

  test('search matches first_name (case-insensitive)', async () => {
    await seedCustomer({ first_name: 'Emily' });
    await seedCustomer({ contact_code: 'C-002', personal_number: '2', first_name: 'Bob' });
    const res = await request(app).get('/api/admin/customers?search=emi').set(bearer(admin.token));
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].first_name).toBe('Emily');
  });

  test('limit + offset honored', async () => {
    for (let i = 0; i < 5; i++) {
      await seedCustomer({ contact_code: `C-${i}`, personal_number: `pn-${i}` });
    }
    const res = await request(app).get('/api/admin/customers?limit=2&offset=1').set(bearer(admin.token));
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(5);
  });

  test('400 when active is invalid', async () => {
    const res = await request(app).get('/api/admin/customers?active=maybe').set(bearer(admin.token));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/admin/customers/:contactId', () => {
  test('returns customer with images/leads/applications', async () => {
    const id = await seedCustomer();
    const res = await request(app).get(`/api/admin/customers/${id}`).set(bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.contact_id).toBe(id);
    expect(res.body.images).toEqual([]);
    expect(res.body.leads).toEqual([]);
    expect(res.body.applications).toEqual([]);
  });

  test('400 for non-numeric id', async () => {
    expect((await request(app).get('/api/admin/customers/abc').set(bearer(admin.token))).status).toBe(400);
  });

  test('404 when not found', async () => {
    expect((await request(app).get('/api/admin/customers/999999').set(bearer(admin.token))).status).toBe(404);
  });
});

describe('PATCH /api/admin/customers/:contactId/active', () => {
  test('flips is_active', async () => {
    const id = await seedCustomer();
    const res = await request(app)
      .patch(`/api/admin/customers/${id}/active`)
      .set(bearer(admin.token))
      .send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.is_active).toBe(false);
  });

  test('400 when isActive not boolean', async () => {
    const id = await seedCustomer();
    expect((await request(app).patch(`/api/admin/customers/${id}/active`).set(bearer(admin.token)).send({})).status).toBe(400);
    expect((await request(app).patch(`/api/admin/customers/${id}/active`).set(bearer(admin.token)).send({ isActive: 'yes' })).status).toBe(400);
  });

  test('404 when id unknown', async () => {
    const res = await request(app).patch('/api/admin/customers/999999/active').set(bearer(admin.token)).send({ isActive: true });
    expect(res.status).toBe(404);
  });

  test('403 for staff role', async () => {
    const id = await seedCustomer();
    const res = await request(app).patch(`/api/admin/customers/${id}/active`).set(bearer(staff.token)).send({ isActive: false });
    expect(res.status).toBe(403);
  });
});
