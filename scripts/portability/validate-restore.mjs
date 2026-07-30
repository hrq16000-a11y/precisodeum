#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const targetUrl = process.env.TARGET_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.TARGET_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const bundleFile = resolve(process.argv[2] || 'portability-user-ref-media.zip');

if (!targetUrl || !serviceKey) {
  console.error('Missing TARGET_SUPABASE_URL/TARGET_SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const db = createClient(targetUrl, serviceKey, { auth: { persistSession: false } });
const zip = await JSZip.loadAsync(await readFile(bundleFile));
const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const results = [];

for (const file of manifest.files || []) {
  const { data, error } = await db.storage.from(file.bucket).download(file.path);
  if (error || !data) {
    results.push({ ...file, ok: false, reason: error?.message || 'missing' });
    continue;
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  const actual = sha256(buffer);
  results.push({ ...file, ok: actual === file.sha256, actual_sha256: actual, actual_bytes: buffer.length });
}

const { data: mediaRows, error: mediaError } = await db
  .from('media')
  .select('id,user_ref,storage_path,public_url,is_active')
  .eq('is_active', true)
  .limit(10000);

const orphanMedia = (mediaRows || []).filter((row) => !row.user_ref).length;
const report = {
  ok: results.every((row) => row.ok) && !mediaError && orphanMedia === 0,
  files_expected: results.length,
  files_ok: results.filter((row) => row.ok).length,
  files_failed: results.filter((row) => !row.ok).length,
  active_media_rows_checked: mediaRows?.length || 0,
  active_media_without_user_ref: orphanMedia,
  media_error: mediaError?.message || null,
};
await writeFile(resolve(`${bundleFile}.validation-report.json`), JSON.stringify({ report, files: results }, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 2);