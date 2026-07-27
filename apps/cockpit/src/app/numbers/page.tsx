import { supabase as adminClient } from '@/lib/supabase';
import Link from 'next/link';
import NumberChecker, { type TakenEntry } from './NumberChecker';

export const dynamic = 'force-dynamic';

// Drivers pick a permanent number in this range. #1 is reserved for the
// reigning Division 1 champion and is assigned by an admin, not self-picked.
const MIN = 2;
const MAX = 999;

type DriverRow = {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  driver_number: number | null;
  prior_driver_number: number | null;
};

// Prefer the structured name; fall back to display_name with the bot's
// "┊ number" suffix stripped so the list reads cleanly.
function cleanName(d: DriverRow): string {
  const full = [d.first_name, d.last_name].filter(Boolean).join(' ').trim();
  if (full) return full;
  const dn = (d.display_name ?? '').split('┊')[0].trim();
  return dn || '—';
}

type Entry = { number: number; name: string; reserved: boolean };

export default async function NumbersPage() {
  const { data } = await adminClient
    .from('drivers')
    .select('first_name, last_name, display_name, driver_number, prior_driver_number')
    .or('driver_number.not.is.null,prior_driver_number.not.is.null')
    .order('driver_number', { ascending: true });

  const rows = (data ?? []) as DriverRow[];

  // Every number that's spoken for: active numbers, plus numbers held for a
  // champion's return (reserved — not pickable by anyone else).
  const entries: Entry[] = [];
  for (const d of rows) {
    const name = cleanName(d);
    if (d.driver_number != null)
      entries.push({ number: d.driver_number, name, reserved: false });
    if (d.prior_driver_number != null)
      entries.push({ number: d.prior_driver_number, name, reserved: true });
  }
  entries.sort((a, b) => a.number - b.number);

  const takenMap: Record<number, TakenEntry> = {};
  for (const e of entries) takenMap[e.number] = { name: e.name, reserved: e.reserved };

  // Availability is over the 2..999 pool; #1 sits outside it. A number is
  // unavailable if it's an active number OR held for a champion's return.
  const pickable = MAX - MIN + 1; // 998
  const unavailable = entries.filter(
    (e) => e.number >= MIN && e.number <= MAX,
  ).length;
  const available = pickable - unavailable;

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <Link
        href="/profile"
        className="inline-block mb-8 font-mono text-[11px] tracking-[.15em] uppercase text-txt-3 hover:text-gold transition-colors"
      >
        ← Back to profile
      </Link>
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — Driver Numbers
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-6">
        Number Registry
      </h1>
      <p className="font-sans text-[15px] text-txt-2 leading-relaxed max-w-[640px] mb-10">
        Every driver runs a permanent number from{' '}
        <strong className="text-txt">2–999</strong>. #1 is reserved for the
        reigning Division 1 champion, who holds it until the title passes — their
        own number stays reserved for their return. Check whether a number is
        free below.
      </p>

      <NumberChecker takenMap={takenMap} min={MIN} max={MAX} />

      <div className="flex gap-10 mt-12 mb-10">
        <div>
          <p className="font-display font-black text-[32px] text-txt tabular-nums leading-none">
            {unavailable}
          </p>
          <p className="font-mono text-[10px] tracking-[.25em] uppercase text-txt-3 mt-1">
            Taken
          </p>
        </div>
        <div>
          <p className="font-display font-black text-[32px] text-gold tabular-nums leading-none">
            {available}
          </p>
          <p className="font-mono text-[10px] tracking-[.25em] uppercase text-txt-3 mt-1">
            Available
          </p>
        </div>
      </div>

      <p className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-3 mb-6">
        Assigned Numbers
      </p>
      {entries.length === 0 ? (
        <p className="font-sans text-[14px] text-txt-3">
          No numbers assigned yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {entries.map((e) => (
            <div
              key={`${e.number}-${e.reserved ? 'r' : 'a'}`}
              className={[
                'border bg-panel px-3 py-2 flex items-baseline gap-2 min-w-0',
                e.reserved ? 'border-dashed border-line-2' : 'border-line',
              ].join(' ')}
            >
              <span
                className={[
                  'font-display font-black text-[18px] tabular-nums shrink-0',
                  e.reserved ? 'text-txt-3' : 'text-gold',
                ].join(' ')}
              >
                {e.number}
              </span>
              <span className="font-mono text-[11px] text-txt-2 truncate">
                {e.name}
                {e.reserved && (
                  <span className="text-txt-3"> · held</span>
                )}
                {e.number === 1 && (
                  <span className="text-gold"> · champ</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/profile"
        className="inline-block mt-12 font-mono text-[11px] tracking-[.15em] uppercase text-txt-3 hover:text-gold transition-colors"
      >
        ← Back to profile
      </Link>
    </section>
  );
}
