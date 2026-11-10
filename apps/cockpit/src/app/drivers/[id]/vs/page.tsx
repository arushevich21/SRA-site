import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { bareDriverName } from '@/lib/driver-display-name';
import { getDriverDirectory } from '@/lib/driver-directory';
import { getDriverProfile, getDriversByPlayerIds } from '@/lib/driver-profile';
import { BackLink } from '@/components/BackLink';

// Head-to-head picker: search for anyone, or pick from the drivers this one
// has shared the most race grids with (driver_frequent_rivals).

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const driver = await getDriverProfile((await params).id);
  return { title: driver ? `${bareDriverName(driver.display_name)} — Head to Head` : 'Driver not found' };
}

type Rival = { id: string; name: string; number: number | null; meetings: number; ahead: number; behind: number };

async function getRivals(playerId: string): Promise<Rival[]> {
  const { data, error } = await supabase.rpc('driver_frequent_rivals', { p_player: playerId, p_limit: 8 });
  if (error) console.error('driver_frequent_rivals failed:', error);
  const rows = (data ?? []) as Array<{ player_id: string; meetings: number; ahead: number; behind: number }>;
  const drivers = await getDriversByPlayerIds(rows.map((r) => r.player_id));
  return rows.flatMap((r) => {
    const d = drivers.get(r.player_id);
    return d
      ? [{ id: d.id, name: bareDriverName(d.display_name), number: d.driver_number, meetings: Number(r.meetings), ahead: Number(r.ahead), behind: Number(r.behind) }]
      : [];
  });
}

export default async function HeadToHeadPicker({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const rawQ = (await searchParams).q;
  const q = (Array.isArray(rawQ) ? rawQ[0] : rawQ ?? '').trim().slice(0, 60);

  const driver = await getDriverProfile(id);
  if (!driver || !driver.steam_id) notFound();
  const name = bareDriverName(driver.display_name);

  const [rivals, search] = await Promise.all([
    getRivals(`S${driver.steam_id}`),
    q ? getDriverDirectory({ search: q, sort: 'wins', division: null, page: 1 }) : Promise.resolve(null),
  ]);
  const matches = (search?.rows ?? []).filter((r) => r.id !== driver.id).slice(0, 20);

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <BackLink fallbackHref={`/drivers/${driver.id}`} fallbackLabel={name} />
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">— Head to Head</span>
      <h1 className="font-display font-black text-[clamp(36px,5vw,64px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        {name} vs…
      </h1>

      <form method="get" className="flex flex-wrap items-end gap-3 mb-8">
        <label className="flex flex-col gap-1 flex-1 min-w-[220px] max-w-[420px]">
          <span className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3">Find a driver</span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Name or number"
            className="bg-panel border border-line px-4 py-2.5 font-sans text-[14px] text-txt placeholder:text-txt-3 focus:border-gold outline-none"
          />
        </label>
        <button
          type="submit"
          className="font-mono text-[12px] tracking-[.2em] uppercase px-5 py-3 bg-gold text-carbon font-bold hover:bg-gold-soft transition-colors"
        >
          Search
        </button>
      </form>

      {q && (
        <div className="border border-line bg-panel mb-10">
          <p className="font-mono text-[11px] tracking-[.35em] uppercase text-gold px-6 pt-5 pb-3">
            {matches.length ? `Matches for “${q}”` : `No drivers match “${q}”`}
          </p>
          {matches.map((m) => (
            <Link
              key={m.id}
              href={`/drivers/${driver.id}/vs/${m.id}`}
              className="flex items-center justify-between gap-4 px-6 py-3 border-t border-line hover:bg-panel-2 group"
            >
              <span className="font-sans text-[15px] text-txt group-hover:text-gold">
                {bareDriverName(m.displayName)}
                {m.driverNumber != null && <span className="ml-2 font-mono text-[12px] text-txt-3">#{m.driverNumber}</span>}
              </span>
              <span className="font-mono text-[12px] text-txt-3">
                {m.starts ? `${m.starts} starts · ${m.wins ?? 0} wins` : 'No GT3 results'} →
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="border border-line bg-panel">
        <p className="font-mono text-[11px] tracking-[.35em] uppercase text-gold px-6 pt-5 pb-3">Most-met rivals</p>
        {rivals.length === 0 ? (
          <p className="font-sans text-[14px] text-txt-2 px-6 pb-5">
            No shared race grids matched yet. Search above to compare with anyone.
          </p>
        ) : (
          rivals.map((r) => (
            <Link
              key={r.id}
              href={`/drivers/${driver.id}/vs/${r.id}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-6 py-3 border-t border-line hover:bg-panel-2 group"
            >
              <span className="font-sans text-[15px] text-txt group-hover:text-gold truncate">
                {r.name}
                {r.number != null && <span className="ml-2 font-mono text-[12px] text-txt-3">#{r.number}</span>}
              </span>
              <span className="font-mono text-[12px] text-txt-2">
                {r.meetings} races · <span className={r.ahead >= r.behind ? 'text-gold' : ''}>{r.ahead}</span>–{r.behind} →
              </span>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
