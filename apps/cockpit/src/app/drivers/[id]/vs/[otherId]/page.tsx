import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { bareDriverName } from '@/lib/driver-display-name';
import { getDriverProfile, type DriverProfileRow } from '@/lib/driver-profile';
import { getHeadToHead } from '@/lib/head-to-head';
import { BackLink } from '@/components/BackLink';
import { DriverTierBadge } from '@/components/DriverTierBadge';
import { TaleOfTape, type TapeSide } from '@/components/TaleOfTape';

// Head-to-head between two drivers. Reads rollups refreshed nightly, so an
// hourly ISR window is plenty. The URL is the share link.
export const revalidate = 3600;

const BOARDS_SHOWN = 8;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; otherId: string }>;
}): Promise<Metadata> {
  const { id, otherId } = await params;
  const [a, b] = await Promise.all([getDriverProfile(id), getDriverProfile(otherId)]);
  return {
    title: a && b ? `${bareDriverName(a.display_name)} vs ${bareDriverName(b.display_name)}` : 'Head to Head',
  };
}

function Side({ d, align }: { d: DriverProfileRow; align: 'left' | 'right' }) {
  const image = d.photo_url ?? d.avatar_url;
  return (
    <Link
      href={`/drivers/${d.id}`}
      className={`flex items-center gap-4 min-w-0 group ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}
    >
      {image ? (
        <Image src={image} alt="" width={72} height={72} className="rounded-full shrink-0 object-cover w-[72px] h-[72px]" />
      ) : (
        <div className="w-[72px] h-[72px] rounded-full bg-panel-2 shrink-0" />
      )}
      <div className="min-w-0">
        <div className="font-display font-black text-[clamp(24px,3vw,36px)] uppercase leading-[.95] text-txt group-hover:text-gold">
          {bareDriverName(d.display_name)}
        </div>
        <div className={`flex items-center gap-2 mt-2 ${align === 'right' ? 'justify-end' : ''}`}>
          {d.driver_number != null && (
            <span className="font-mono text-[12px] tracking-[.2em] text-txt-3">#{d.driver_number}</span>
          )}
          <DriverTierBadge isSralien={d.is_sralien} division={d.division_id} tier={d.tier} />
        </div>
      </div>
    </Link>
  );
}

export default async function HeadToHeadPage({ params }: { params: Promise<{ id: string; otherId: string }> }) {
  const { id, otherId } = await params;
  if (id === otherId) notFound();
  const [a, b] = await Promise.all([getDriverProfile(id), getDriverProfile(otherId)]);
  if (!a?.steam_id || !b?.steam_id) notFound();

  const aName = bareDriverName(a.display_name);
  const bName = bareDriverName(b.display_name);
  const h2h = await getHeadToHead(
    { id: a.id, name: aName, number: a.driver_number, steamId: a.steam_id, division: a.division_id },
    { id: b.id, name: bName, number: b.driver_number, steamId: b.steam_id, division: b.division_id },
  );

  const tape = (s: typeof h2h.a): TapeSide => ({
    starts: s.record?.starts ?? null,
    wins: s.record?.wins ?? null,
    podiums: s.record?.podiums ?? null,
    top10s: s.record?.top10s ?? null,
    avgFinish: s.record?.avgFinish ?? null,
    composite: s.rating?.composite ?? null,
  });
  const total = h2h.meetings.length;

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <BackLink fallbackHref={`/drivers/${a.id}`} fallbackLabel={aName} />
        <div className="flex gap-6 mb-8">
          <Link
            href={`/drivers/${b.id}/vs/${a.id}`}
            className="font-mono text-[12px] tracking-[.2em] uppercase text-txt-3 hover:text-gold"
          >
            ⇄ Swap sides
          </Link>
          <Link
            href={`/drivers/${a.id}/vs`}
            className="font-mono text-[12px] tracking-[.2em] uppercase text-txt-3 hover:text-gold"
          >
            Change rival
          </Link>
        </div>
      </div>
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-8">— Head to Head</span>

      {/* Scoreboard */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] border border-line bg-panel mb-6">
        <div className="p-6 md:p-8">
          <Side d={a} align="left" />
        </div>
        <div className="px-8 py-6 border-y md:border-y-0 md:border-x border-line flex flex-col items-center justify-center gap-2 min-w-[260px]">
          {total > 0 ? (
            <>
              <div className="font-display font-black text-[80px] leading-[.9] flex items-baseline gap-4">
                <span className={h2h.aAhead > h2h.bAhead ? 'text-gold' : 'text-txt'}>{h2h.aAhead}</span>
                <span className="text-[36px] text-txt-3">–</span>
                <span className={h2h.bAhead > h2h.aAhead ? 'text-gold' : 'text-txt'}>{h2h.bAhead}</span>
              </div>
              <span className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 text-center">
                Finished ahead · {total} race{total === 1 ? '' : 's'} on the same grid
              </span>
              <div className="w-full h-2 flex gap-[2px]" aria-hidden="true">
                <div className="bg-txt-2" style={{ flex: h2h.aAhead || 0.0001 }} />
                <div className="bg-gold" style={{ flex: h2h.bAhead || 0.0001 }} />
              </div>
            </>
          ) : (
            <span className="font-sans text-[14px] text-txt-2 text-center max-w-[240px]">
              No races on the same grid found yet.
            </span>
          )}
        </div>
        <div className="p-6 md:p-8">
          <Side d={b} align="right" />
        </div>
      </div>
      {(h2h.differentDivisions > 0 || h2h.unmatched > 0) && (
        <p className="font-sans text-[13px] text-txt-3 mb-10">
          {h2h.differentDivisions > 0 && (
            <>
              {h2h.differentDivisions} more round{h2h.differentDivisions === 1 ? '' : 's'} both raced in different
              divisions (not counted).{' '}
            </>
          )}
          {h2h.unmatched > 0 && (
            <>
              {h2h.unmatched} round{h2h.unmatched === 1 ? '' : 's'} both raced couldn&apos;t be matched to a race
              grid, so {h2h.unmatched === 1 ? 'it isn’t' : 'they aren’t'} counted.
            </>
          )}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TaleOfTape a={tape(h2h.a)} b={tape(h2h.b)} aName={aName} bName={bName} />

        <div className="border border-line bg-panel px-7 py-6">
          <p className="font-mono text-[11px] tracking-[.35em] uppercase text-gold mb-5">
            Meetings{total > 0 ? ` · ${total}` : ''}
          </p>
          {total === 0 ? (
            <p className="font-sans text-[14px] text-txt-2">They haven&apos;t shared a race grid that we can match yet.</p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-panel">
                  <tr className="font-mono text-[10px] tracking-[.15em] uppercase text-txt-3">
                    <th className="font-normal pb-2">Round</th>
                    <th className="font-normal pb-2">Track</th>
                    <th className="font-normal pb-2 text-right truncate max-w-[90px]">{aName.split(' ')[0]}</th>
                    <th className="font-normal pb-2 text-right truncate max-w-[90px]">{bName.split(' ')[0]}</th>
                  </tr>
                </thead>
                <tbody>
                  {h2h.meetings.map((m) => (
                    <tr key={`${m.season}-${m.round}`} className="border-t border-line">
                      <td className="py-2 font-mono text-[13px] text-txt-2 whitespace-nowrap">
                        S{m.season} R{m.round}
                      </td>
                      <td className="py-2 font-sans text-[14px] text-txt">
                        {m.href ? (
                          <Link href={m.href} className="hover:text-gold hover:underline underline-offset-4">
                            {m.track} →
                          </Link>
                        ) : (
                          m.track
                        )}
                      </td>
                      <td className={`py-2 text-right font-display text-[18px] ${m.aPos < m.bPos ? 'text-gold' : 'text-txt-2'}`}>
                        P{m.aPos}
                      </td>
                      <td className={`py-2 text-right font-display text-[18px] ${m.bPos < m.aPos ? 'text-gold' : 'text-txt-2'}`}>
                        P{m.bPos}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {h2h.boards.shared.length > 0 && (
        <div className="border border-line bg-panel px-7 py-6 mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
            <p className="font-mono text-[11px] tracking-[.35em] uppercase text-gold">Hot Lap Boards</p>
            <p className="font-sans text-[14px] text-txt-2">
              {h2h.boards.shared.length} seasonal board{h2h.boards.shared.length === 1 ? '' : 's'} in common —{' '}
              {aName.split(' ')[0]} faster on <span className="text-txt font-semibold">{h2h.boards.aFaster}</span>,{' '}
              {bName.split(' ')[0]} on <span className="text-txt font-semibold">{h2h.boards.bFaster}</span>.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            {h2h.boards.shared.slice(0, BOARDS_SHOWN).map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="grid grid-cols-[minmax(0,1fr)_56px_56px] items-center gap-3 py-2.5 border-t border-line group"
              >
                <span className="font-sans text-[14px] text-txt group-hover:text-gold truncate">
                  {s.track} <span className="font-mono text-[11px] text-txt-3">{s.season}</span>
                </span>
                <span className={`text-right font-display text-[18px] ${s.aPos < s.bPos ? 'text-gold' : 'text-txt-2'}`}>
                  P{s.aPos}
                </span>
                <span className={`text-right font-display text-[18px] ${s.bPos < s.aPos ? 'text-gold' : 'text-txt-2'}`}>
                  P{s.bPos}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
