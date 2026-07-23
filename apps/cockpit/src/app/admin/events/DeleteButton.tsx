'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteChampionship } from './actions';

export function DeleteButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function onDelete() {
    startTransition(async () => {
      const res = await deleteChampionship(id);
      if (res.ok) router.refresh();
      else {
        alert(`Delete failed: ${res.error}`);
        setConfirming(false);
      }
    });
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)}
        className="font-mono text-[11px] tracking-[.15em] uppercase text-txt-3 hover:text-gold-deep cursor-pointer">
        Delete
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <span className="font-mono text-[11px] text-gold-deep">Delete “{title}”?</span>
      <button type="button" onClick={onDelete} disabled={pending}
        className="font-mono text-[11px] tracking-[.15em] uppercase text-gold-deep hover:text-gold cursor-pointer disabled:opacity-50">
        {pending ? '…' : 'Yes'}
      </button>
      <button type="button" onClick={() => setConfirming(false)}
        className="font-mono text-[11px] tracking-[.15em] uppercase text-txt-3 hover:text-txt cursor-pointer">
        No
      </button>
    </span>
  );
}
