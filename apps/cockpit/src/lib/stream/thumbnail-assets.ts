import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Raster ingredients for the YouTube/Twitch race thumbnails (/thumbnail/…).
// Satori (next/og) composes the picture but can't blur or read WebP, so
// every bitmap goes through sharp first and reaches Satori as a sized PNG /
// JPEG data URL. Each result is memoised for the life of the process: the
// same 24 circuit photos and 11 partner logos serve every thumbnail.

export const THUMB_WIDTH = 1280;
export const THUMB_HEIGHT = 720;

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const FONT_DIR = path.join(process.cwd(), 'src', 'app', 'thumbnail', '_fonts');

export type ThumbImage = { src: string; width: number; height: number };

const cache = new Map<string, Promise<unknown>>();
function memo<T>(key: string, make: () => Promise<T>): Promise<T> {
  let hit = cache.get(key) as Promise<T> | undefined;
  if (!hit) {
    hit = make().catch((err) => {
      cache.delete(key);
      throw err;
    });
    cache.set(key, hit);
  }
  return hit;
}

function publicFile(publicPath: string): string {
  // Partner logo paths are URL-encoded in content/partners.ts ("White%20Text").
  return path.join(PUBLIC_DIR, decodeURIComponent(publicPath.replace(/^\//, '')));
}

function dataUrl(mime: string, buf: Buffer): string {
  return `data:${mime};base64,${buf.toString('base64')}`;
}

// Saira Condensed — the overlays' display face (--ov-display), so the
// thumbnail reads as the same brand as the stream graphics.
export function thumbnailFonts(): Promise<{ name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[]> {
  return memo('fonts', async () => {
    const load = async (weight: 700 | 900) => {
      const buf = await readFile(path.join(FONT_DIR, `SairaCondensed-${weight}.woff`));
      return { name: 'Saira Condensed', data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), weight, style: 'normal' as const };
    };
    return Promise.all([load(700), load(900)]);
  });
}

// The circuit hero photo (the hot-lap boards' splash art), cropped to the
// thumbnail frame, softened and darkened so white and gold type sits on it.
export function thumbnailBackdrop(photoPublicPath: string): Promise<string> {
  return memo(`backdrop:${photoPublicPath}`, async () => {
    const buf = await sharp(publicFile(photoPublicPath))
      .resize(THUMB_WIDTH, THUMB_HEIGHT, { fit: 'cover' })
      .blur(4)
      .modulate({ brightness: 0.55, saturation: 0.9 })
      .jpeg({ quality: 82 })
      .toBuffer();
    return dataUrl('image/jpeg', buf);
  });
}

// Any badge / map / logo, scaled to fit a box (aspect kept) and re-encoded as
// PNG. Returns the rendered size so the <img> can be given exact dimensions,
// which Satori requires.
export function thumbnailImage(publicPath: string, maxWidth: number, maxHeight: number): Promise<ThumbImage> {
  return memo(`img:${publicPath}:${maxWidth}x${maxHeight}`, async () => {
    const image = sharp(publicFile(publicPath));
    const meta = await image.metadata();
    const scale = Math.min(maxWidth / (meta.width ?? maxWidth), maxHeight / (meta.height ?? maxHeight), 1);
    // Rasterise at 2x so the PNG is crisp after Satori's own resampling.
    const width = Math.max(1, Math.round((meta.width ?? maxWidth) * scale));
    const height = Math.max(1, Math.round((meta.height ?? maxHeight) * scale));
    const buf = await image
      .resize(width * 2, height * 2, { fit: 'inside', withoutEnlargement: false })
      .png()
      .toBuffer();
    return { src: dataUrl('image/png', buf), width, height };
  });
}
