'use client';

import { useEffect, useState } from 'react';

// The server doesn't know the visitor's timezone, so schedule times must be
// formatted client-side — Date#toLocaleTimeString/toLocaleDateString resolve
// to the browser's local timezone when run there, vs. the server's when run
// during SSR. `initial` is the server-computed value (same timezone-naive
// logic as before) so first paint/hydration has something to show; the
// effect then corrects it to the viewer's actual local timezone.
function localParts(iso: string | null): { date: string; time: string | null } {
  if (!iso) return { date: 'TBA', time: null };
  const hasTime = iso.includes('T');
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (!hasTime) return { date, time: null };
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  return { date, time };
}

export function LocalScheduleDate({ iso, initial }: { iso: string | null; initial: string }) {
  const [label, setLabel] = useState(initial);
  useEffect(() => {
    setLabel(localParts(iso).date);
  }, [iso]);
  return <>{label}</>;
}

export function LocalScheduleTime({ iso, initial }: { iso: string | null; initial: string | null }) {
  const [label, setLabel] = useState(initial);
  useEffect(() => {
    setLabel(localParts(iso).time);
  }, [iso]);
  if (!label) return null;
  return <>{label}</>;
}
