'use client';

import { useActionState } from 'react';
import { updateProfileDetails, type ProfileDetailsState } from './actions';
import { COUNTRIES } from '@/lib/countries';

export default function ProfileDetailsForm({
  firstName,
  lastName,
  shortName,
  country,
  driverNumber,
}: {
  firstName: string | null;
  lastName: string | null;
  shortName: string | null;
  country: string | null;
  driverNumber: number | null;
}) {
  const [state, action, pending] = useActionState<ProfileDetailsState, FormData>(
    updateProfileDetails,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="font-mono text-[11px] tracking-[.25em] uppercase text-txt-3">
          First name
        </label>
        <input
          name="first_name"
          defaultValue={firstName ?? ''}
          required
          className="bg-panel-2 border border-line px-4 py-3 font-mono text-[13px] text-txt placeholder:text-txt-3 focus:outline-none focus:border-gold w-full"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="font-mono text-[11px] tracking-[.25em] uppercase text-txt-3">
          Last name
        </label>
        <input
          name="last_name"
          defaultValue={lastName ?? ''}
          required
          className="bg-panel-2 border border-line px-4 py-3 font-mono text-[13px] text-txt placeholder:text-txt-3 focus:outline-none focus:border-gold w-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label className="font-mono text-[11px] tracking-[.25em] uppercase text-txt-3">
            Short name (3 letters)
          </label>
          <input
            name="short_name"
            defaultValue={shortName ?? ''}
            required
            maxLength={3}
            minLength={3}
            placeholder="ABC"
            className="bg-panel-2 border border-line px-4 py-3 font-mono text-[13px] text-txt uppercase placeholder:text-txt-3 focus:outline-none focus:border-gold w-full"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="font-mono text-[11px] tracking-[.25em] uppercase text-txt-3">
            Driver number (2-999)
          </label>
          <input
            name="driver_number"
            type="number"
            min={2}
            max={999}
            defaultValue={driverNumber ?? ''}
            placeholder="e.g. 47"
            className="bg-panel-2 border border-line px-4 py-3 font-mono text-[13px] text-txt placeholder:text-txt-3 focus:outline-none focus:border-gold w-full"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="font-mono text-[11px] tracking-[.25em] uppercase text-txt-3">
          Country
        </label>
        <select
          name="country"
          defaultValue={country ?? ''}
          className="bg-panel-2 border border-line px-4 py-3 font-mono text-[13px] text-txt focus:outline-none focus:border-gold w-full"
        >
          <option value="">— Select —</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {state?.error && (
        <p className="font-mono text-[11px] tracking-[.15em] uppercase text-red-400">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="font-mono text-[11px] tracking-[.15em] uppercase text-green-400">
          Profile saved.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start font-mono text-[11px] tracking-[.15em] uppercase px-5 py-3 bg-gold text-carbon font-bold hover:bg-gold-soft transition-colors disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
