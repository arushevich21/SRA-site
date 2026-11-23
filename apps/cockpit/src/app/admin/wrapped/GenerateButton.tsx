'use client';

import { useActionState } from 'react';
import { generateWrappedSnapshot, type SnapshotResult } from './actions';

export function GenerateButton() {
  const [result, run, pending] = useActionState<SnapshotResult>(generateWrappedSnapshot, null);
  return (
    <form action={run} className="flex flex-col gap-3 items-start">
      <button
        type="submit"
        disabled={pending}
        className="font-sans font-semibold text-[14px] px-5 py-3 bg-gold text-carbon hover:bg-gold-soft transition-colors disabled:opacity-50"
      >
        {pending ? 'Generating…' : 'Generate snapshot'}
      </button>
      <p role="status" className="font-sans text-[13px]">
        {result?.ok && <span className="text-green-400">Stored {result.cards} cards.</span>}
        {result && !result.ok && (
          <span className="text-red-400">
            Couldn’t generate: {result.error}.
            {/relation .* does not exist|wrapped_/i.test(result.error) &&
              ' Run supabase/migrations/20261124_wrapped.sql first.'}
          </span>
        )}
      </p>
    </form>
  );
}
