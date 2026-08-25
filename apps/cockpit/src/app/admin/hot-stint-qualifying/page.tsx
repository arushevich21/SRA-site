import Link from 'next/link';
import { msToLaptime } from '@sra/domain';
import { requireAdmin } from '@/lib/require-admin';
import {
  getCurrentClassificationScope,
  getAdminClassificationHotStint,
} from '@/lib/acc/hot-stint-store';

// Admin-only: every column of classification_status, via the service-role
// client. This is what's permanently excluded from the public leaderboard
// (/[sim]/leaderboards/hotstint-qualifying) — num_laps, eligibility,
// discord_id/steam_id, and rating internals. Always fresh (force-dynamic,
// same as every other admin page here) — this isn't the cached public path.
export const dynamic = 'force-dynamic';

export default async function AdminHotStintQualifyingPage() {
  await requireAdmin();

  const scope = await getCurrentClassificationScope();
  const rows = scope ? await getAdminClassificationHotStint(scope.series, scope.season) : [];

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <Link
        href="/admin"
        className="inline-block mb-8 font-mono text-[11px] tracking-[.15em] uppercase text-txt-3 hover:text-gold transition-colors"
      >
        ← Back to admin
      </Link>
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — Admin
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-4">
        Hot Stint Qualifying
      </h1>
      <p className="font-sans text-sm text-txt-3 mb-10 max-w-[640px]">
        Written by an external bot into <code>classification</code>/
        <code>classification_status</code> — this page is read-only. Lap counts,
        eligibility, and rating internals here are permanently admin-only; the
        public leaderboard shows only position, driver name, and time.
      </p>

      {!scope ? (
        <p className="font-mono text-sm text-txt-3">No classification run in progress.</p>
      ) : (
        <>
          <p className="font-mono text-[13px] tracking-[.1em] uppercase text-txt-3 mb-4">
            {scope.series} — Season {scope.season} · {rows.length} driver{rows.length === 1 ? '' : 's'}
          </p>
          <div className="border border-line overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-line bg-carbon-2">
                  {[
                    'Pos',
                    'Driver',
                    'Car',
                    'Discord ID',
                    'Driver ID',
                    'Steam ID',
                    'Signed Up',
                    'Has Account',
                    'Has Hotstint',
                    'Eligible',
                    'Stint Avg',
                    'Num Laps',
                    'Returning',
                    'SRating Ordinal',
                    'Composite',
                    'Pace %',
                  ].map((h) => (
                    <th
                      key={h}
                      className="font-mono text-[11px] tracking-[.1em] uppercase text-txt-3 px-4 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.discordId} className="border-b border-line/50 last:border-b-0">
                    <td className="font-mono text-[12px] text-txt-3 px-4 py-2">{r.position}</td>
                    <td className="font-sans text-[13px] text-txt px-4 py-2">{r.driverName}</td>
                    <td className="font-sans text-[12px] text-txt-2 px-4 py-2">{r.carModelName ?? '—'}</td>
                    <td className="font-mono text-[12px] text-txt-2 px-4 py-2">{r.discordId}</td>
                    <td className="font-mono text-[12px] text-txt-2 px-4 py-2">{r.driverId ?? '—'}</td>
                    <td className="font-mono text-[12px] text-txt-2 px-4 py-2">{r.steamId ?? '—'}</td>
                    <td className="font-mono text-[12px] px-4 py-2">{r.hasSignup ? 'Y' : 'N'}</td>
                    <td className="font-mono text-[12px] px-4 py-2">{r.hasAccount ? 'Y' : 'N'}</td>
                    <td className="font-mono text-[12px] px-4 py-2">{r.hasHotstint ? 'Y' : 'N'}</td>
                    <td className="font-mono text-[12px] px-4 py-2">{r.eligible ? 'Y' : 'N'}</td>
                    <td className="font-mono text-[12px] text-txt px-4 py-2">
                      {r.hotstintMs != null ? msToLaptime(r.hotstintMs) : '—'}
                    </td>
                    <td className="font-mono text-[12px] text-txt px-4 py-2">{r.numLaps ?? '—'}</td>
                    <td className="font-mono text-[12px] px-4 py-2">{r.isReturning ? 'Y' : 'N'}</td>
                    <td className="font-mono text-[12px] text-txt-2 px-4 py-2">
                      {r.sratingOrdinal != null ? r.sratingOrdinal.toFixed(4) : '—'}
                    </td>
                    <td className="font-mono text-[12px] text-txt-2 px-4 py-2">
                      {r.composite != null ? r.composite.toFixed(4) : '—'}
                    </td>
                    <td className="font-mono text-[12px] text-txt-2 px-4 py-2">
                      {r.pacePct != null ? r.pacePct.toFixed(4) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
