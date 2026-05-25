const path = require('path');
const fs = require('fs-extra');

const db = require('../utils/db');

const STORAGE_ROOT_PARENT = path.resolve(process.cwd()); // storage_path is "scorm/{uuid}" relative to this
const VALID_STATUSES = ['draft', 'published', 'archived'];

function assertValidStatus(status) {
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    const err = new Error(`Invalid status: ${status}. Must be one of ${VALID_STATUSES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
}

async function createCourse({ title, description, status, createdBy }) {
  if (!title || typeof title !== 'string' || !title.trim()) {
    const err = new Error('title is required');
    err.statusCode = 400;
    throw err;
  }
  assertValidStatus(status);

  const { rows } = await db.query(
    `INSERT INTO courses (title, description, status, created_by)
     VALUES ($1, $2, COALESCE($3, 'draft'), $4)
     RETURNING id, title, description, status, created_by, created_at, updated_at`,
    [title.trim(), description ?? null, status ?? null, createdBy]
  );
  return rows[0];
}

async function listCourses({ status, limit = 50, offset = 0 } = {}) {
  assertValidStatus(status);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const where = [];
  const params = [];
  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  params.push(safeLimit, safeOffset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const itemsQ = db.query(
    `SELECT c.id, c.title, c.description, c.status, c.created_by,
            c.created_at, c.updated_at,
            (SELECT COUNT(*)::int FROM scorm_packages p WHERE p.course_id = c.id) AS package_count
       FROM courses c
       ${whereSql}
       ORDER BY c.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  const countQ = db.query(
    `SELECT COUNT(*)::int AS total FROM courses ${whereSql}`,
    params.slice(0, params.length - 2)
  );

  const [items, count] = await Promise.all([itemsQ, countQ]);

  return {
    items: items.rows,
    total: count.rows[0].total,
    limit: safeLimit,
    offset: safeOffset,
  };
}

async function getCourseById(courseId) {
  const { rows } = await db.query(
    `SELECT id, title, description, status, created_by, created_at, updated_at
       FROM courses WHERE id = $1`,
    [courseId]
  );
  if (rows.length === 0) return null;

  const course = rows[0];
  const pkgs = await db.query(
    `SELECT id, scorm_version, storage_path, entry_point, title,
            file_count, total_size_bytes, status, uploaded_at, uploaded_by
       FROM scorm_packages
      WHERE course_id = $1
      ORDER BY uploaded_at DESC`,
    [courseId]
  );

  return {
    ...course,
    packages: pkgs.rows,
    latest_package: pkgs.rows[0] ?? null,
  };
}

async function updateCourse(courseId, { title, description, status }) {
  assertValidStatus(status);

  const sets = [];
  const params = [];
  if (title !== undefined) {
    if (!title || !String(title).trim()) {
      const err = new Error('title cannot be empty');
      err.statusCode = 400;
      throw err;
    }
    params.push(String(title).trim());
    sets.push(`title = $${params.length}`);
  }
  if (description !== undefined) {
    params.push(description);
    sets.push(`description = $${params.length}`);
  }
  if (status !== undefined) {
    params.push(status);
    sets.push(`status = $${params.length}`);
  }
  if (sets.length === 0) return getCourseById(courseId);

  sets.push(`updated_at = now()`);
  params.push(courseId);

  const { rows } = await db.query(
    `UPDATE courses SET ${sets.join(', ')}
      WHERE id = $${params.length}
      RETURNING id, title, description, status, created_by, created_at, updated_at`,
    params
  );
  return rows[0] ?? null;
}

async function deleteCourse(courseId) {
  const { rows: pkgs } = await db.query(
    `SELECT id, storage_path FROM scorm_packages WHERE course_id = $1`,
    [courseId]
  );

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    if (pkgs.length > 0) {
      const ids = pkgs.map(p => p.id);
      await client.query(
        `DELETE FROM scorm_package_files WHERE package_id = ANY($1::int[])`,
        [ids]
      );
      await client.query(
        `DELETE FROM scorm_tracking WHERE package_id = ANY($1::int[])`,
        [ids]
      );
      await client.query(
        `DELETE FROM scorm_packages WHERE course_id = $1`,
        [courseId]
      );
    }
    const del = await client.query(
      `DELETE FROM courses WHERE id = $1 RETURNING id`,
      [courseId]
    );
    await client.query('COMMIT');

    if (del.rowCount === 0) return false;

    for (const p of pkgs) {
      const dir = path.resolve(STORAGE_ROOT_PARENT, p.storage_path);
      await fs.remove(dir).catch(err =>
        console.error(`[lessonService] failed to remove ${dir}:`, err.message)
      );
    }
    return true;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function listPackagesByCourse(courseId) {
  const { rows } = await db.query(
    `SELECT id, course_id, scorm_version, storage_path, entry_point, title,
            file_count, total_size_bytes, status, uploaded_at, uploaded_by
       FROM scorm_packages
      WHERE course_id = $1
      ORDER BY uploaded_at DESC`,
    [courseId]
  );
  return rows;
}

async function getPackageById(packageId) {
  const { rows } = await db.query(
    `SELECT id, course_id, uploaded_by, scorm_version, storage_path, entry_point,
            title, manifest_data, file_count, total_size_bytes, status, uploaded_at
       FROM scorm_packages WHERE id = $1`,
    [packageId]
  );
  return rows[0] ?? null;
}

async function getPackageFiles(packageId) {
  const { rows } = await db.query(
    `SELECT id, relative_path, mime_type, size_bytes
       FROM scorm_package_files
      WHERE package_id = $1
      ORDER BY relative_path`,
    [packageId]
  );
  return rows;
}

async function deletePackage(packageId) {
  const pkg = await getPackageById(packageId);
  if (!pkg) return false;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM scorm_tracking WHERE package_id = $1`, [packageId]);
    await client.query(`DELETE FROM scorm_package_files WHERE package_id = $1`, [packageId]);
    await client.query(`DELETE FROM scorm_packages WHERE id = $1`, [packageId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  const dir = path.resolve(STORAGE_ROOT_PARENT, pkg.storage_path);
  await fs.remove(dir).catch(err =>
    console.error(`[lessonService] failed to remove ${dir}:`, err.message)
  );
  return true;
}

module.exports = {
  createCourse,
  listCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  listPackagesByCourse,
  getPackageById,
  getPackageFiles,
  deletePackage,
};
