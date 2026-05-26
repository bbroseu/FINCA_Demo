const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

const { processScormUpload } = require('../services/scormUploadService');
const lessonService = require('../services/lessonService');
const scormAttemptService = require('../services/scormAttemptService');
const requireJwt = require('../middleware/requireJwt');
const requireCustomerJwt = require('../middleware/requireCustomerJwt');

const router = express.Router();

const TMP_DIR = path.resolve(process.cwd(), 'tmp');
fs.ensureDirSync(TMP_DIR);

function parsePositiveInt(value, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    const err = new Error(`Invalid ${name}`);
    err.statusCode = 400;
    throw err;
  }
  return n;
}

function sendError(res, err) {
  const status = err.statusCode
    || (err.message?.includes('imsmanifest.xml missing') ? 400
        : err.message?.includes('Path traversal') ? 400
        : err.message?.includes('Uncompressed archive') ? 400
        : 500);
  return res.status(status).json({ error: err.message });
}

// -----------------------------------------------------------------------------
// Multer config for SCORM upload
// -----------------------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TMP_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.fieldname}${path.extname(file.originalname) || '.zip'}`),
});

const fileFilter = (req, file, cb) => {
  const isZipMime = file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed';
  const isZipExt = path.extname(file.originalname).toLowerCase() === '.zip';
  if (isZipMime || isZipExt) return cb(null, true);
  const err = new Error('Only .zip files are accepted');
  err.statusCode = 400;
  return cb(err);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});


// =============================================================================
// COURSES (e-learning lessons)
//   POST   /courses           — JWT required
//   GET    /courses           — public
//   GET    /courses/:id       — public
//   PUT    /courses/:id       — public for now (auth not requested)
//   DELETE /courses/:id       — JWT required
// =============================================================================

router.post('/courses', requireJwt, async (req, res) => {
  try {
    const course = await lessonService.createCourse({
      title: req.body?.title,
      description: req.body?.description,
      status: req.body?.status,
      createdBy: req.user.id,
    });
    return res.status(201).json(course);
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/courses', async (req, res) => {
  try {
    const result = await lessonService.listCourses({
      status: req.query.status,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    return res.json(result);
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/courses/:courseId', async (req, res) => {
  try {
    const courseId = parsePositiveInt(req.params.courseId, 'courseId');
    const course = await lessonService.getCourseById(courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    return res.json(course);
  } catch (err) {
    return sendError(res, err);
  }
});

router.put('/courses/:courseId', async (req, res) => {
  try {
    const courseId = parsePositiveInt(req.params.courseId, 'courseId');
    const updated = await lessonService.updateCourse(courseId, {
      title: req.body?.title,
      description: req.body?.description,
      status: req.body?.status,
    });
    if (!updated) return res.status(404).json({ error: 'Course not found' });
    return res.json(updated);
  } catch (err) {
    return sendError(res, err);
  }
});

router.delete('/courses/:courseId', requireJwt, async (req, res) => {
  try {
    const courseId = parsePositiveInt(req.params.courseId, 'courseId');
    const deleted = await lessonService.deleteCourse(courseId);
    if (!deleted) return res.status(404).json({ error: 'Course not found' });
    return res.status(204).end();
  } catch (err) {
    return sendError(res, err);
  }
});


// =============================================================================
// SCORM PACKAGES — all endpoints require JWT
// =============================================================================

// POST /api/scorm/courses/:courseId/scorm  — upload a SCORM .zip
router.post('/courses/:courseId/scorm', requireJwt, upload.single('package'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const courseId = parsePositiveInt(req.params.courseId, 'courseId');

    const course = await lessonService.getCourseById(courseId);
    if (!course) {
      await fs.remove(req.file.path).catch(() => {});
      return res.status(404).json({ error: 'Course not found' });
    }

    const result = await processScormUpload(courseId, req.user.id, req.file.path, req.file.originalname);
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/courses/:courseId/packages', requireJwt, async (req, res) => {
  try {
    const courseId = parsePositiveInt(req.params.courseId, 'courseId');
    const packages = await lessonService.listPackagesByCourse(courseId);
    return res.json({ items: packages });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/packages/:packageId', requireJwt, async (req, res) => {
  try {
    const packageId = parsePositiveInt(req.params.packageId, 'packageId');
    const pkg = await lessonService.getPackageById(packageId);
    if (!pkg) return res.status(404).json({ error: 'Package not found' });
    return res.json(pkg);
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/packages/:packageId/files', requireJwt, async (req, res) => {
  try {
    const packageId = parsePositiveInt(req.params.packageId, 'packageId');
    const files = await lessonService.getPackageFiles(packageId);
    return res.json({ items: files });
  } catch (err) {
    return sendError(res, err);
  }
});

router.delete('/packages/:packageId', requireJwt, async (req, res) => {
  try {
    const packageId = parsePositiveInt(req.params.packageId, 'packageId');
    const deleted = await lessonService.deletePackage(packageId);
    if (!deleted) return res.status(404).json({ error: 'Package not found' });
    return res.status(204).end();
  } catch (err) {
    return sendError(res, err);
  }
});


// =============================================================================
// COURSE PARTICIPATION — scorm_tracking (per-customer attempts)
// Customer JWT required. Ownership enforced on the single-attempt route.
// =============================================================================

// POST /api/scorm/packages/:packageId/attempts
//   Starts a new attempt, or resumes the customer's current incomplete one.
router.post('/packages/:packageId/attempts', requireCustomerJwt, async (req, res) => {
  try {
    const packageId = parsePositiveInt(req.params.packageId, 'packageId');
    const attempt = await scormAttemptService.startOrResumeAttempt(packageId, req.customer.contact_id);
    return res.status(attempt.resumed ? 200 : 201).json(attempt);
  } catch (err) {
    return sendError(res, err);
  }
});

// PATCH /api/scorm/attempts/:attemptId
//   Body fields (all optional): completion_status, success_status,
//   score_raw, score_max, session_time_seconds (DELTA — accumulates),
//   suspend_data.
router.patch('/attempts/:attemptId', requireCustomerJwt, async (req, res) => {
  try {
    const attemptId = parsePositiveInt(req.params.attemptId, 'attemptId');
    const existing = await scormAttemptService.getAttemptById(attemptId);
    if (!existing) return res.status(404).json({ error: 'Attempt not found' });
    if (existing.customer_contact_id !== req.customer.contact_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const updated = await scormAttemptService.updateAttempt(attemptId, req.body || {});
    return res.json(updated);
  } catch (err) {
    return sendError(res, err);
  }
});

// GET /api/scorm/me/attempts
//   List the authenticated customer's attempts (with package + course info).
router.get('/me/attempts', requireCustomerJwt, async (req, res) => {
  try {
    const items = await scormAttemptService.listAttemptsForCustomer(req.customer.contact_id);
    return res.json({ items });
  } catch (err) {
    return sendError(res, err);
  }
});


// -----------------------------------------------------------------------------
// Multer-level errors (file size, filter rejection)
// -----------------------------------------------------------------------------
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err && err.statusCode === 400) {
    return res.status(400).json({ error: err.message });
  }
  return next(err);
});

module.exports = router;
