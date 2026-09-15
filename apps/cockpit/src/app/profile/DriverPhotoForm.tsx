'use client';

import { useActionState, useState } from 'react';
import { removeDriverPhoto, uploadDriverPhoto, type PhotoState } from './actions';

export const DRIVER_PHOTO_PLACEHOLDER = '/badges/driver-placeholder.png';

// Largest edge of what we send. The stream shows the photo at ~512px, so
// 1024 leaves headroom for 1440p and is ~150 KB as WebP — an 8 MB phone
// photo becomes that before it leaves the browser. Vercel refuses request
// bodies over 4.5 MB, so this resize is what makes "any photo" work.
const MAX_EDGE = 1024;

// The photo shown on stream. Preview swaps to the chosen file before upload
// so what you see is what goes on air.
export default function DriverPhotoForm({ photoUrl }: { photoUrl: string | null }) {
  const [uploadState, uploadAction, uploading] = useActionState<PhotoState, FormData>(
    uploadDriverPhoto,
    null,
  );
  const [removeState, removeAction, removing] = useActionState<PhotoState>(removeDriverPhoto, null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<File | null>(null);
  const [prepError, setPrepError] = useState<string | null>(null);

  const shown = preview ?? photoUrl ?? DRIVER_PHOTO_PLACEHOLDER;
  const state = prepError ? { error: prepError } : (uploadState ?? removeState);

  async function onPick(file: File | undefined) {
    setPrepError(null);
    setPrepared(null);
    if (!file) return setPreview(null);
    try {
      const resized = await squareAndResize(file, MAX_EDGE);
      setPrepared(resized);
      setPreview(URL.createObjectURL(resized));
    } catch {
      setPrepError("Couldn't read that image. Try a PNG or JPG.");
      setPreview(null);
    }
  }

  // The file input carries the original; swap in the resized one at submit.
  function submitPrepared(formData: FormData) {
    if (prepared) formData.set('photo', prepared, prepared.name);
    return uploadAction(formData);
  }

  return (
    <div className="flex gap-6 items-start">
      {/* eslint-disable-next-line @next/next/no-img-element -- user upload / static placeholder */}
      <img
        src={shown}
        alt=""
        width={128}
        height={128}
        className="w-32 h-32 rounded-full object-cover shrink-0 border border-line bg-panel-2"
      />

      <div className="flex-1 min-w-0">
        <p className="font-sans text-[13px] text-txt-2 mb-3">
          Shown on the race broadcast when you&apos;re in the commentary booth. Any photo works —
          it&apos;s cropped square and resized here before upload. Leave it empty to use the stock
          image.
        </p>

        <form action={submitPrepared} className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            name="photo"
            accept="image/*"
            required
            onChange={(e) => void onPick(e.target.files?.[0])}
            className="font-mono text-[12px] text-txt-2 file:mr-3 file:px-4 file:py-2 file:border file:border-line file:bg-panel-2 file:text-txt file:font-mono file:text-[11px] file:tracking-[.2em] file:uppercase file:cursor-pointer hover:file:border-gold"
          />
          <button
            type="submit"
            disabled={uploading || !prepared}
            className="font-mono text-[11px] tracking-[.2em] uppercase px-5 py-2.5 bg-gold text-carbon font-bold hover:bg-gold-soft disabled:opacity-50 transition-colors"
          >
            {uploading ? 'Uploading…' : 'Upload photo'}
          </button>
        </form>

        {photoUrl && (
          <form action={removeAction} className="mt-3">
            <button
              type="submit"
              disabled={removing}
              className="font-mono text-[11px] tracking-[.15em] uppercase text-txt-3 hover:text-txt disabled:opacity-50 transition-colors"
            >
              {removing ? 'Removing…' : 'Remove photo'}
            </button>
          </form>
        )}

        {state?.error && (
          <p className="font-mono text-[12px] text-red-400 mt-3">{state.error}</p>
        )}
        {state?.success && !state.error && (
          <p className="font-mono text-[11px] tracking-[.2em] uppercase text-green-400 mt-3">
            Saved
          </p>
        )}
      </div>
    </div>
  );
}

// Centre-crops to a square and scales the long edge down to `maxEdge`,
// re-encoding as WebP. Never upscales a small image. Runs entirely in the
// browser; the server still enforces type and size on what arrives.
async function squareAndResize(file: File, maxEdge: number): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const target = Math.min(side, maxEdge);
    const canvas = document.createElement('canvas');
    canvas.width = target;
    canvas.height = target;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      target,
      target,
    );
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.9),
    );
    if (!blob) throw new Error('encode failed');
    return new File([blob], 'photo.webp', { type: 'image/webp' });
  } finally {
    bitmap.close();
  }
}
