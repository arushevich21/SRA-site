'use client';

import { useActionState } from 'react';
import { updateSteamId, type SteamLinkState } from './actions';

export default function SteamLinkForm({
  currentSteamId,
}: {
  currentSteamId: string | null;
}) {
  const [state, action, pending] = useActionState<SteamLinkState, FormData>(
    updateSteamId,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="font-mono text-[11px] tracking-[.25em] uppercase text-txt-3">
        Steam64 ID
      </label>
      <input
        name="steam_id"
        defaultValue={currentSteamId ?? ''}
        placeholder="76561198..."
        maxLength={17}
        className="bg-panel-2 border border-line px-4 py-3 font-mono text-[13px] text-txt placeholder:text-txt-3 focus:outline-none focus:border-gold w-full"
      />
      {state?.error && (
        <p className="font-mono text-[11px] tracking-[.15em] uppercase text-red-400">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="font-mono text-[11px] tracking-[.15em] uppercase text-green-400">
          Steam ID saved.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start font-mono text-[11px] tracking-[.15em] uppercase px-5 py-3 bg-gold text-carbon font-bold hover:bg-gold-soft transition-colors disabled:opacity-50"
      >
        {pending ? 'Saving…' : currentSteamId ? 'Update' : 'Link Steam ID'}
      </button>
    </form>
  );
}
