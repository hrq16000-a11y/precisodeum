#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const sourceUrl = process.env.SOURCE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const outFile = resolve(process.argv[2] || 'portability-user-ref-media.zip');
const buckets = (process.env.PORTABILITY_BUCKETS || 'avatars,portfolio,service-images,sponsors,sponsor_assets')
  .split(',').map((v) => v.trim()).filter(Boolean);

if (!sourceUrl || !serviceKey) {
  console.error('Missing SOURCE_SUPABASE_URL/SOURCE_SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const db = createClient(sourceUrl, serviceKey, { auth: { persistSession: false } });
const zip = new JSZip();
const logs = [];
const manifest = { generated_at: new Date().toISOString(), buckets, media: [], files: [], coverage: {} };

const log = (entry) => logs.push({ at: new Date().toISOString(), ...entry });
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function resolveObject(row) {
  const storagePath = String(row.storage_path || '').replace(/^\/+/, '');
  for (const bucket of buckets) {
    if (storagePath.startsWith(`${bucket}/`)) return { bucket, path: storagePath.slice(bucket.length + 1) };
  }
  const publicUrl = String(row.public_url || '');
  const match = publicUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (match) return { bucket: match[1], path: decodeURIComponent(match[2]) };
  return { bucket: row.bucket || null, path: storagePath || null };
}

async function selectAll(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

const media = await selectAll('media', 'id,user_ref,storage_path,public_url,entity_type,entity_ref,original_name,mime_type,size_original,is_active,created_at');
const active = media.filter((row) => row.is_active !== false);
const missingUserRef = active.filter((row) => !row.user_ref);
manifest.coverage.media_total = media.length;
manifest.coverage.media_active = active.length;
manifest.coverage.media_active_with_user_ref = active.length - missingUserRef.length;
manifest.coverage.media_active_without_user_ref = missingUserRef.length;
manifest.media = active.map((row) => ({ ...row, object: resolveObject(row) }));

for (const row of manifest.media) {
  const { bucket, path } = row.object || {};
  if (!bucket || !path) {
    log({ level: 'warn', kind: 'unresolved_object', media_id: row.id, storage_path: row.storage_path });
    continue;
  }
  const { data, error } = await db.storage.from(bucket).download(path);
  if (error || !data) {
    log({ level: 'error', kind: 'download_failed', bucket, path, media_id: row.id, error: error?.message || 'download failed' });
    continue;
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  const checksum = sha256(buffer);
  zip.file(`storage/${bucket}/${path}`, buffer);
  manifest.files.push({ bucket, path, media_id: row.id, user_ref: row.user_ref, bytes: buffer.length, sha256: checksum });
  log({ level: 'info', kind: 'file_exported', bucket, path, bytes: buffer.length, sha256: checksum });
}

manifest.coverage.files_exported = manifest.files.length;
manifest.coverage.download_errors = logs.filter((entry) => entry.kind === 'download_failed').length;
zip.file('manifest.json', JSON.stringify(manifest, null, 2));
zip.file('logs/export.jsonl', logs.map((entry) => JSON.stringify(entry)).join('\n') + '\n');
zip.file('reports/coverage.json', JSON.stringify(manifest.coverage, null, 2));

await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log(JSON.stringify({ ok: true, output: outFile, coverage: manifest.coverage }, null, 2));