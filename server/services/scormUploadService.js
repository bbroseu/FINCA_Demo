const path = require('path');
const fs = require('fs-extra');
const unzipper = require('unzipper');
const mime = require('mime-types');
const { XMLParser } = require('fast-xml-parser');
const { v4: uuidv4 } = require('uuid');

const db = require('../utils/db');

const STORAGE_ROOT = path.resolve(process.cwd(), 'storage', 'scorm');
const MAX_UNCOMPRESSED_BYTES = Number(process.env.SCORM_MAX_UNCOMPRESSED_BYTES || 2 * 1024 * 1024 * 1024); // 2 GB

function pickFirst(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseManifest(xmlString) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const parsed = parser.parse(xmlString);
  const manifest = parsed.manifest || {};

  const schemaVersion = String(manifest.metadata?.schemaversion ?? '');
  const scormVersion = schemaVersion.includes('2004') ? '2004' : '1.2';

  const resource = pickFirst(manifest.resources?.resource);
  const entryPoint = resource?.['@_href'] || 'index.html';

  const organization = pickFirst(manifest.organizations?.organization);
  const title = (typeof organization?.title === 'string' ? organization.title : organization?.title?.['#text']) || 'Untitled';

  return { scormVersion, entryPoint, title, raw: manifest };
}

async function extractZipSafely(zipPath, destDir) {
  await fs.ensureDir(destDir);
  const resolvedDest = path.resolve(destDir) + path.sep;

  let uncompressedTotal = 0;
  // Collect per-entry write completions so 'close' can't resolve before files
  // are flushed to disk — otherwise imsmanifest.xml can appear missing in
  // a rapid follow-up read.
  const pending = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(zipPath)
      .pipe(unzipper.Parse())
      .on('entry', (entry) => {
        const work = (async () => {
          const target = path.resolve(destDir, entry.path);
          if (!(target + path.sep).startsWith(resolvedDest) && target !== resolvedDest.slice(0, -1)) {
            entry.autodrain();
            throw new Error(`Path traversal blocked: ${entry.path}`);
          }

          if (entry.type === 'Directory') {
            await fs.ensureDir(target);
            entry.autodrain();
            return;
          }

          const declaredSize = Number(entry.vars?.uncompressedSize || 0);
          uncompressedTotal += declaredSize;
          if (uncompressedTotal > MAX_UNCOMPRESSED_BYTES) {
            entry.autodrain();
            throw new Error('Uncompressed archive exceeds maximum allowed size');
          }

          await fs.ensureDir(path.dirname(target));
          await new Promise((res, rej) => {
            entry.pipe(fs.createWriteStream(target))
              .on('error', rej)
              .on('finish', res);
          });
        })();
        work.catch(reject);
        pending.push(work);
      })
      .on('error', reject)
      .on('close', () => {
        Promise.all(pending).then(() => resolve()).catch(reject);
      });
  });
}

async function walkFiles(rootDir) {
  const out = [];
  async function recurse(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await recurse(full);
      } else if (entry.isFile()) {
        const stat = await fs.stat(full);
        const relative = path.relative(rootDir, full).split(path.sep).join('/');
        out.push({
          relativePath: relative,
          mimeType: mime.lookup(full) || 'application/octet-stream',
          size: stat.size,
        });
      }
    }
  }
  await recurse(rootDir);
  return out;
}

async function processScormUpload(courseId, uploadedBy, zipPath, originalName) {
  const uuid = uuidv4();
  const storageKey = `scorm/${uuid}`;
  const destDir = path.join(STORAGE_ROOT, uuid);
  let extracted = false;

  try {
    await extractZipSafely(zipPath, destDir);
    extracted = true;

    const manifestPath = path.join(destDir, 'imsmanifest.xml');
    if (!(await fs.pathExists(manifestPath))) {
      throw new Error('Not a valid SCORM package: imsmanifest.xml missing');
    }

    const xml = await fs.readFile(manifestPath, 'utf8');
    const { scormVersion, entryPoint, title, raw } = parseManifest(xml);

    const files = await walkFiles(destDir);
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

    const client = await db.getClient();
    let packageId;
    try {
      await client.query('BEGIN');

      const insertPkg = await client.query(
        `INSERT INTO scorm_packages
           (course_id, uploaded_by, scorm_version, storage_path, entry_point,
            title, manifest_data, file_count, total_size_bytes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ready')
         RETURNING id`,
        [courseId, uploadedBy, scormVersion, storageKey, entryPoint,
         title, JSON.stringify(raw), files.length, totalBytes]
      );
      packageId = insertPkg.rows[0].id;

      if (files.length > 0) {
        const values = [];
        const params = [];
        files.forEach((f, i) => {
          const base = i * 4;
          values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
          params.push(packageId, f.relativePath, f.mimeType, f.size);
        });
        await client.query(
          `INSERT INTO scorm_package_files
             (package_id, relative_path, mime_type, size_bytes)
           VALUES ${values.join(', ')}`,
          params
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    return { packageId, entryPoint, scormVersion, title };
  } catch (err) {
    if (extracted) {
      await fs.remove(destDir).catch(() => {});
    }
    console.error(`[scorm] upload failed for ${originalName}:`, err.message);
    throw err;
  } finally {
    await fs.remove(zipPath).catch(() => {});
  }
}

module.exports = { processScormUpload };
