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

describe('POST /api/document/upload', () => {
  test('401 without token', async () => {
    expect((await request(app).post('/api/document/upload')).status).toBe(401);
  });

  test('400 with no body at all (bug fix — must not 500)', async () => {
    const res = await request(app).post('/api/document/upload').set(bearer(staff.token));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Contact code is required');
  });

  test('400 without contactCode', async () => {
    const res = await request(app).post('/api/document/upload').set(bearer(staff.token)).attach('selfie', PNG);
    expect(res.status).toBe(400);
  });

  test('400 with contactCode but no files', async () => {
    const res = await request(app).post('/api/document/upload').set(bearer(staff.token)).field('contactCode', 'CC-1');
    expect(res.status).toBe(400);
  });

  test('uploads a selfie and returns DocumentFileId', async () => {
    setAspektResponse('POST', '/api/createDocument/', { status: 200, data: { Body: { DocumentFileId: 1234 } } });
    const res = await request(app).post('/api/document/upload').set(bearer(staff.token))
      .field('contactCode', 'CC-1').attach('selfie', PNG);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, documentIds: [1234] });
  });

  test('uploads both selfie and idDocument', async () => {
    let n = 0;
    setAspektResponse('POST', '/api/createDocument/', () => ({ status: 200, data: { Body: { DocumentFileId: ++n } } }));
    const res = await request(app).post('/api/document/upload').set(bearer(staff.token))
      .field('contactCode', 'CC-1').attach('selfie', PNG).attach('idDocument', PNG);
    expect(res.status).toBe(200);
    expect(res.body.documentIds).toEqual([1, 2]);
  });

  test('400 when an attached file is not image/pdf (filter)', async () => {
    const res = await request(app).post('/api/document/upload').set(bearer(staff.token))
      .field('contactCode', 'CC-1')
      .attach('selfie', Buffer.from('hi'), { filename: 'x.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
  });
});
