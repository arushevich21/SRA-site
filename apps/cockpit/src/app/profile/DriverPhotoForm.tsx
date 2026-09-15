'use client';

import { useActionState, useState } from 'react';
import { removeDriverPhoto, uploadDriverPhoto, type PhotoState } from './actions';

export const DRIVER_PHOTO_PLACEHOLDER = '/badges/driver-placeholder.png';

// The photo shown on stream. Preview swaps to the chosen file before upload
// so what you see is what goes on air.
export default function DriverPhotoForm({ photoUrl }: { photoUrl: string | null }) {
  const [uploadState, uploadAction, uploading] = useActionState<PhotoState, FormData>(
    uploadDriverPhoto,
    null,
  );
  const [removeState, removeAction, removing] = useActionState<PhotoState>(removeDriverPhoto, null);
  const [preview, setPreview] = useState<string | null>(null);

  const shown = preview ?? photoUrl ?? DRIVER_PHOTO_PLACEHOLDER;
  const state = uploadState ?? removeState;

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
          Shown on the race broadcast when you&apos;re in the commentary booth. Square, at least
          512×512, under 2 MB. Leave it empty to use the stock image.
        </p>

        <form action={uploadAction} className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            name="photo"
            accept="image/png,image/jpeg,image/webp"
            required
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
            className="font-mono text-[12px] text-txt-2 file:mr-3 file:px-4 file:py-2 file:border file:border-line file:bg-panel-2 file:text-txt file:font-mono file:text-[11px] file:tracking-[.2em] file:uppercase file:cursor-pointer hover:file:border-gold"
          />
          <button
            type="submit"
            disabled={uploading}
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
