#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';

const targetUrl = process.env.TARGET_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.TARGET_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const bundleFile = resolve(process.argv[2] || 'portability-user-ref-media.zip');
const dryRun = process.argv.includes('--dry-run');

if (!targetUrl || !serviceKey) {
  console.error('Missing TARGET_SUPABASE_URL/TARGET_SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const db = createClient(targetUrl, serviceKey, { auth: { persistSession: false } });
const zip = await JSZip.loadAsync(await readFile(bundleFile));
const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
const logs = [];
const log = (entry) => logs.push({ at: new Date().toISOString(), ...entry });
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

for (const file of manifest.files || []) {
  const entry = zip.file(`storage/${file.bucket}/${file.path}`);
  if (!entry) {
    log({ level: 'error', kind: 'missing_in_bundle', bucket: file.bucket, path: file.path });
    continue;
  }
  const buffer = await entry.async('nodebuffer');
  const actual = sha256(buffer);
  if (file.sha256 && file.sha256 !== actual) {
    log({ level: 'error', kind: 'checksum_mismatch_before_upload', bucket: file.bucket, path: file.path, expected: file.sha256, actual });
    continue;
  }
  if (!dryRun) {
    const { error } = await db.storage.from(file.bucket).upload(file.path, buffer, {
      upsert: true,
      contentType: file.mime_type || 'application/octet-stream',
    });
    if (error) {
      log({ level: 'error', kind: 'upload_failed', bucket: file.bucket, path: file.path, error: error.message });
      continue;
    }
  }
  log({ level: 'info', kind: dryRun ? 'would_upload' : 'uploaded', bucket: file.bucket, path: file.path, sha256: actual });
}

const report = {
  ok: logs.every((entry) => entry.level !== 'error'),
  dry_run: dryRun,
  source_bundle: basename(bundleFile),
  files_expected: (manifest.files || []).length,
  uploaded: logs.filter((entry) => entry.kind === 'uploaded' || entry.kind === 'would_upload').length,
  errors: logs.filter((entry) => entry.level === 'error').length,
};
await writeFile(resolve(`${bundleFile}.restore-report.json`), JSON.stringify({ report, logs }, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 2);