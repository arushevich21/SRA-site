import { supabase as adminClient } from '@/lib/supabase';
import Link from 'next/link';
import NumberChecker, { type TakenEntry } from './NumberChecker';

export const dynamic = 'force-dynamic';

// Drivers pick a permanent number in this range. #1 is not stored — it's a
// derived badge for the reigning D1 champion (drivers.is_champion), who keeps
// their own number too.
const MIN = 2;
const MAX = 999;

type DriverRow = {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  driver_number: number | null;
  is_champion: boolean | null;
};

// Prefer the structured name; fall back to display_name with the bot's
// "┊ number" suffix stripped so the list reads cleanly.
function cleanName(d: DriverRow): string {
  const full = [d.first_name, d.last_name].filter(Boolean).join(' ').trim();
  if (full) return full;
  return (d.display_name ?? '').split('┊')[0].trim() || '—';
}

type Entry = { number: number; name: string; champion: boolean };

export default async function NumbersPage() {
  const { data } = await adminClient
    .from('drivers')
    .select('first_name, last_name, display_name, driver_number, is_champion')
    .or('driver_number.not.is.null,is_champion.is.true')
    .order('driver_number', { ascending: true });

  const rows = (data ?? []) as DriverRow[];

  // Every number that's spoken for: real driver numbers (2–999), plus a derived
  // #1 for the champion (who also keeps their own number).
  const entries: Entry[] = [];
  for (const d of rows) {
    const name = cleanName(d);
    if (d.driver_number != null)
      entries.push({ number: d.driver_number, name, champion: false });
    if (d.is_champion) entries.push({ number: 1, name, champion: true });
  }
  entries.sort((a, b) => a.number - b.number);

  const takenMap: Record<number, TakenEntry> = {};
  for (const e of entries) takenMap[e.number] = { name: e.name, champion: e.champion };

  // Availability is over the 2..999 pool; #1 sits outside it.
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
        <strong className="text-txt">2–999</strong>. #1 is the reigning Division
        1 champion&apos;s badge — they run it while keeping their own number.
        Check whether a number is free below.
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
              key={`${e.number}-${e.champion ? 'c' : 'a'}`}
              className="border border-line bg-panel px-3 py-2 flex items-baseline gap-2 min-w-0"
            >
              <span className="font-display font-black text-[18px] text-gold tabular-nums shrink-0">
                {e.number}
              </span>
              <span className="font-mono text-[11px] text-txt-2 truncate">
                {e.name}
                {e.champion && <span className="text-gold"> · champ</span>}
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
