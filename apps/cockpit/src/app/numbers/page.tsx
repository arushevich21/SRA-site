import { supabase as adminClient } from '@/lib/supabase';
import Link from 'next/link';
import NumberChecker, { type TakenEntry } from './NumberChecker';
import NumberBrowser from './NumberBrowser';

// Busted on demand by revalidatePath in admin/numbers + profile actions, but
// numbers also change in SQL (a champion handover runs in the SQL editor),
// which no revalidatePath sees — so refresh on a timer as well.
export const revalidate = 300;

// Drivers pick a permanent number in this range. #1 is the reigning D1
// champion's: they run it (driver_number = 1) while their own number sits in
// reserved_number, taken but unnamed, until they lose the title. See
// supabase/migrations/20261123c_champion_runs_number_one.sql.
const MIN = 2;
const MAX = 999;

type DriverRow = {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  driver_number: number | null;
  reserved_number: number | null;
  is_champion: boolean | null;
};

// Prefer the structured name; fall back to display_name with the bot's
// "┊ number" suffix stripped so the list reads cleanly.
function cleanName(d: DriverRow): string {
  const full = [d.first_name, d.last_name].filter(Boolean).join(' ').trim();
  if (full) return full;
  return (d.display_name ?? '').split('┊')[0].trim() || '—';
}

type Entry = { number: number; name: string; champion: boolean; reserved: boolean };

export default async function NumbersPage() {
  const { data } = await adminClient
    .from('drivers')
    .select('first_name, last_name, display_name, driver_number, reserved_number, is_champion')
    .not('driver_number', 'is', null)
    .order('driver_number', { ascending: true });

  const rows = (data ?? []) as DriverRow[];

  // Every number that's spoken for. The champion appears once, on #1; their
  // own number is listed as reserved without a name.
  const entries: Entry[] = [];
  for (const d of rows) {
    const champion = d.is_champion === true;
    entries.push({ number: d.driver_number as number, name: cleanName(d), champion, reserved: false });
    if (d.reserved_number != null)
      entries.push({ number: d.reserved_number, name: 'Reserved', champion: false, reserved: true });
  }
  entries.sort((a, b) => a.number - b.number);

  const takenMap: Record<number, TakenEntry> = {};
  for (const e of entries)
    takenMap[e.number] = { name: e.name, champion: e.champion, reserved: e.reserved };

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
        <strong className="text-txt">2–999</strong>. #1 belongs to the reigning
        Division 1 champion for the season, and their own number is held for
        their return. Check a number below, or browse the free ones and pick one for your
        profile.
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

      <p className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-3 mb-4">
        Available Numbers
      </p>
      <div className="mb-14">
        <NumberBrowser takenMap={takenMap} min={MIN} max={MAX} />
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
              key={e.number}
              className="border border-line bg-panel px-3 py-2 flex items-baseline gap-2 min-w-0"
            >
              <span className="font-display font-black text-[18px] text-gold tabular-nums shrink-0">
                {e.number}
              </span>
              <span
                className={`font-mono text-[11px] truncate ${e.reserved ? 'text-txt-3 italic' : 'text-txt-2'}`}
              >
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
