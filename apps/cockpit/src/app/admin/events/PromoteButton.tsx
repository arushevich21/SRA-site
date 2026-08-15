'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { promoteFromWaitlist } from './registrations-actions';

export function PromoteButton({ registrationId }: { registrationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onPromote() {
    startTransition(async () => {
      try {
        await promoteFromWaitlist(registrationId);
        router.refresh();
      } catch (err) {
        alert(`Promote failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    });
  }

  return (
    <button type="button" onClick={onPromote} disabled={pending}
      className="font-mono text-[11px] tracking-[.15em] uppercase text-gold hover:text-gold-soft cursor-pointer disabled:opacity-50 shrink-0">
      {pending ? '…' : 'Promote'}
    </button>
  );
}
