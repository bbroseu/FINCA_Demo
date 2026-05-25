const request = require('supertest');
const path = require('path');
const fs = require('fs-extra');
require('./helpers/aspektMock');

const makeApp = require('./helpers/app');
const { resetDb, closeDb, db } = require('./helpers/db');
const { createUserWithToken, bearer } = require('./helpers/auth');

let app;
let staff, admin, otherStaff;
const SCORM_ZIP = path.resolve(__dirname, 'fixtures', 'scorm.zip');
const STORAGE_ROOT = path.resolve(process.cwd(), 'storage', 'scorm');

// Track storage dirs created during tests so we can clean up.
const createdPaths = new Set();

beforeAll(() => { app = makeApp(); });
beforeEach(async () => {
  await resetDb();
  staff = await createUserWithToken({ email: 's@test.com' });
  admin = await createUserWithToken({ email: 'a@test.com', role: 'admin' });
  otherStaff = await createUserWithToken({ email: 'o@test.com' });
});
afterAll(async () => {
  for (const p of createdPaths) {
    await fs.remove(p).catch(() => {});
  }
  await closeDb();
});

async function createCourse(token = staff.token, body = { title: 'C', status: 'draft' }) {
  const res = await request(app).post('/api/scorm/courses').set(bearer(token)).send(body);
  return res.body;
}

async function uploadPackage(courseId, token = staff.token) {
  const res = await request(app)
    .post(`/api/scorm/courses/${courseId}/scorm`)
    .set(bearer(token))
    .attach('package', SCORM_ZIP);
  if (res.body?.packageId) {
    const { rows } = await db.query('SELECT storage_path FROM scorm_packages WHERE id = $1', [res.body.packageId]);
    if (rows[0]) createdPaths.add(path.resolve(process.cwd(), rows[0].storage_path));
  }
  return res;
}

describe('Courses CRUD', () => {
  test('POST /courses requires auth', async () => {
    expect((await request(app).post('/api/scorm/courses').send({ title: 'X' })).status).toBe(401);
  });

  test('POST /courses 400 without title', async () => {
    expect((await request(app).post('/api/scorm/courses').set(bearer(staff.token)).send({})).status).toBe(400);
  });

  test('POST /courses creates a course', async () => {
    const res = await request(app).post('/api/scorm/courses').set(bearer(staff.token))
      .send({ title: 'My Course', description: 'Hello', status: 'published' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'My Course', status: 'published', created_by: staff.user.id });
  });

  test('GET /courses is public and supports status filter + pagination', async () => {
    await createCourse(staff.token, { title: 'A', status: 'published' });
    await createCourse(staff.token, { title: 'B', status: 'draft' });
    const all = await request(app).get('/api/scorm/courses');
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(2);
    const published = await request(app).get('/api/scorm/courses?status=published&limit=10');
    expect(published.body.items).toHaveLength(1);
    expect(published.body.items[0].title).toBe('A');
  });

  test('GET /courses/:id 400 for non-numeric, 404 for unknown', async () => {
    expect((await request(app).get('/api/scorm/courses/abc')).status).toBe(400);
    expect((await request(app).get('/api/scorm/courses/9999')).status).toBe(404);
  });

  test('PUT /courses/:id updates fields', async () => {
    const course = await createCourse();
    const res = await request(app).put(`/api/scorm/courses/${course.id}`).send({ title: 'Renamed', status: 'archived' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'Renamed', status: 'archived' });
  });

  test('DELETE /courses/:id requires auth, returns 204, then 404', async () => {
    const course = await createCourse();
    expect((await request(app).delete(`/api/scorm/courses/${course.id}`)).status).toBe(401);
    expect((await request(app).delete(`/api/scorm/courses/${course.id}`).set(bearer(staff.token))).status).toBe(204);
    expect((await request(app).delete(`/api/scorm/courses/${course.id}`).set(bearer(staff.token))).status).toBe(404);
  });
});

describe('SCORM package upload + management', () => {
  test('401 without token', async () => {
    expect((await request(app).post('/api/scorm/courses/1/scorm')).status).toBe(401);
  });

  test('400 when no file', async () => {
    const c = await createCourse();
    expect((await request(app).post(`/api/scorm/courses/${c.id}/scorm`).set(bearer(staff.token))).status).toBe(400);
  });

  test('404 when course missing', async () => {
    const res = await request(app).post('/api/scorm/courses/9999/scorm').set(bearer(staff.token)).attach('package', SCORM_ZIP);
    expect(res.status).toBe(404);
  });

  test('400 when file is not a .zip', async () => {
    const c = await createCourse();
    const res = await request(app).post(`/api/scorm/courses/${c.id}/scorm`).set(bearer(staff.token))
      .attach('package', Buffer.from('hi'), { filename: 'x.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
  });

  test('uploads a valid SCORM 1.2 package end-to-end', async () => {
    const c = await createCourse();
    const res = await uploadPackage(c.id);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, scormVersion: '1.2', entryPoint: 'index.html', title: 'Demo' });

    // listing + detail + files
    const list = await request(app).get(`/api/scorm/courses/${c.id}/packages`).set(bearer(staff.token));
    expect(list.body.items).toHaveLength(1);
    const pkg = await request(app).get(`/api/scorm/packages/${res.body.packageId}`).set(bearer(staff.token));
    expect(pkg.body.status).toBe('ready');
    const files = await request(app).get(`/api/scorm/packages/${res.body.packageId}/files`).set(bearer(staff.token));
    expect(files.body.items.map(f => f.relative_path).sort()).toEqual(['imsmanifest.xml', 'index.html']);
  });

  test('404 on unknown package id; 204 on delete then 404', async () => {
    const c = await createCourse();
    const up = await uploadPackage(c.id);
    expect((await request(app).get('/api/scorm/packages/9999').set(bearer(staff.token))).status).toBe(404);
    expect((await request(app).delete(`/api/scorm/packages/${up.body.packageId}`).set(bearer(staff.token))).status).toBe(204);
    expect((await request(app).delete(`/api/scorm/packages/${up.body.packageId}`).set(bearer(staff.token))).status).toBe(404);
  });
});

describe('SCORM attempts', () => {
  async function setupAttempt() {
    const c = await createCourse();
    const up = await uploadPackage(c.id);
    return up.body.packageId;
  }

  test('start, then resume returns 200 with resumed:true', async () => {
    const pkgId = await setupAttempt();
    const start = await request(app).post(`/api/scorm/packages/${pkgId}/attempts`).set(bearer(staff.token));
    expect(start.status).toBe(201);
    expect(start.body.resumed).toBe(false);
    const resume = await request(app).post(`/api/scorm/packages/${pkgId}/attempts`).set(bearer(staff.token));
    expect(resume.status).toBe(200);
    expect(resume.body.resumed).toBe(true);
    expect(resume.body.id).toBe(start.body.id);
  });

  test('PATCH /attempts/:id updates fields for owner', async () => {
    const pkgId = await setupAttempt();
    const start = await request(app).post(`/api/scorm/packages/${pkgId}/attempts`).set(bearer(staff.token));
    const res = await request(app).patch(`/api/scorm/attempts/${start.body.id}`).set(bearer(staff.token))
      .send({ completion_status: 'completed', success_status: 'passed', score_raw: 90, score_max: 100, session_time_seconds: 60, suspend_data: 'x' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ completion_status: 'completed', success_status: 'passed' });
  });

  test('PATCH /attempts/:id by stranger -> 403; by admin -> 200', async () => {
    const pkgId = await setupAttempt();
    const start = await request(app).post(`/api/scorm/packages/${pkgId}/attempts`).set(bearer(staff.token));
    expect((await request(app).patch(`/api/scorm/attempts/${start.body.id}`).set(bearer(otherStaff.token)).send({ session_time_seconds: 1 })).status).toBe(403);
    expect((await request(app).patch(`/api/scorm/attempts/${start.body.id}`).set(bearer(admin.token)).send({ session_time_seconds: 1 })).status).toBe(200);
  });

  test('PATCH /attempts/9999 -> 404', async () => {
    expect((await request(app).patch('/api/scorm/attempts/9999').set(bearer(staff.token)).send({})).status).toBe(404);
  });

  test('GET /me/attempts returns the caller\'s attempts only', async () => {
    const pkgId = await setupAttempt();
    await request(app).post(`/api/scorm/packages/${pkgId}/attempts`).set(bearer(staff.token));
    await request(app).post(`/api/scorm/packages/${pkgId}/attempts`).set(bearer(otherStaff.token));

    const mine = await request(app).get('/api/scorm/me/attempts').set(bearer(staff.token));
    expect(mine.body.items).toHaveLength(1);
    expect(mine.body.items[0].user_id).toBe(staff.user.id);
  });
});
