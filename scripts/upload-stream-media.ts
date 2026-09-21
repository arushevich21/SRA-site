// Uploads large broadcast media (music beds, ad reads, hero clips) to the
// public `stream-media` Supabase Storage bucket, the one
// apps/cockpit/src/lib/stream/media.ts serves the track clips from. OBS
// media/VLC sources in the shared scene collection point at these URLs, so
// the collection travels as one JSON file with no media to hand around.
//
// Usage:
//   pnpm exec tsx scripts/upload-stream-media.ts <local file> <object path> [more pairs...]
//   e.g. … "C:/Users/me/intro.mp4" videos/intro.mp4
//
// Files here run to hundreds of MB, so this speaks Supabase's resumable
// (TUS) endpoint in 6 MB chunks — the only chunk size it accepts — rather
// than one POST. Each upload is an upsert; the served URL is printed at the
// end. The project's global "Upload file size limit" (dashboard → Storage
// settings) still has to be at least the biggest file.
//
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from
// apps/cockpit/.env.local (or the environment).

import { config } from 'dotenv';
import { openSync, readSync, statSync, closeSync } from 'node:fs';
import { extname } from 'node:path';

config({ path: 'apps/cockpit/.env.local' });

const BUCKET = 'stream-media';
const CHUNK = 6 * 1024 * 1024;
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
};

const auth = { authorization: `Bearer ${key}`, apikey: key, 'tus-resumable': '1.0.0' };
const b64 = (s: string) => Buffer.from(s).toString('base64');

async function upload(file: string, object: string) {
  const size = statSync(file).size;
  const contentType = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
  process.stdout.write(`${object}  (${(size / 1e6).toFixed(0)} MB)\n`);

  const create = await fetch(`${url}/storage/v1/upload/resumable`, {
    method: 'POST',
    headers: {
      ...auth,
      'upload-length': String(size),
      'x-upsert': 'true',
      'upload-metadata': [
        `bucketName ${b64(BUCKET)}`,
        `objectName ${b64(object)}`,
        `contentType ${b64(contentType)}`,
        `cacheControl ${b64('31536000')}`,
      ].join(','),
    },
  });
  if (create.status !== 201) throw new Error(`create failed: ${create.status} ${await create.text()}`);
  const location = create.headers.get('location');
  if (!location) throw new Error('no upload location returned');
  const target = location.startsWith('http') ? location : `${url}${location}`;

  const fd = openSync(file, 'r');
  try {
    let offset = 0;
    const buf = Buffer.alloc(CHUNK);
    while (offset < size) {
      const n = readSync(fd, buf, 0, CHUNK, offset);
      const res = await fetch(target, {
        method: 'PATCH',
        headers: { ...auth, 'upload-offset': String(offset), 'content-type': 'application/offset+octet-stream' },
        body: new Uint8Array(buf.subarray(0, n)),
      });
      if (res.status !== 204) throw new Error(`chunk at ${offset} failed: ${res.status} ${await res.text()}`);
      offset = Number(res.headers.get('upload-offset') ?? offset + n);
      process.stdout.write(`\r  ${Math.round((offset / size) * 100)}%`);
    }
  } finally {
    closeSync(fd);
  }
  process.stdout.write(`\r  ${url}/storage/v1/object/public/${BUCKET}/${object}\n`);
}

const args = process.argv.slice(2);
if (args.length === 0 || args.length % 2 !== 0) {
  console.error('usage: upload-stream-media.ts <local file> <object path> [<local file> <object path> ...]');
  process.exit(1);
}
for (let i = 0; i < args.length; i += 2) await upload(args[i], args[i + 1]);
