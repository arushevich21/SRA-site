'use client';

import { useEffect, useState } from 'react';
import { EVENT_SOURCE_TIMEZONE, eventDateTimeParts } from '@/lib/event-time';

// The server doesn't know the visitor's timezone, so schedule times are
// rendered in two steps: first paint shows the time pinned to Eastern with an
// explicit "EDT"/"EST" label (deterministic on server and client, so
// hydration matches and nothing is ever mislabeled), then the effect swaps it
// to the visitor's device timezone ("6:00 PM PDT", "2:00 AM GMT+1"). With JS
// disabled the Eastern label simply stays — still correct, just not local.

export function LocalScheduleDate({ iso }: { iso: string | null }) {
  const [label, setLabel] = useState(() => eventDateTimeParts(iso, EVENT_SOURCE_TIMEZONE).date);
  useEffect(() => {
    setLabel(eventDateTimeParts(iso).date);
  }, [iso]);
  return <>{label}</>;
}

export function LocalScheduleTime({ iso }: { iso: string | null }) {
  const [label, setLabel] = useState(() => eventDateTimeParts(iso, EVENT_SOURCE_TIMEZONE).time);
  useEffect(() => {
    setLabel(eventDateTimeParts(iso).time);
  }, [iso]);
  if (!label) return null;
  return <>{label}</>;
}
