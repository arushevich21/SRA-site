import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import { accCarModelName, msToLaptime, type PrequalStandingRow } from '@sra/domain';
import { getSimBySlug } from '@/content/sims';
import { LeaderboardTabs } from '@/components/LeaderboardTabs';
import { GameLabel } from '@/components/GameLabel';
import { CarIcon } from '@/components/CarIcon';
import { HotStintDeadlineCountdown } from '@/components/HotStintDeadlineCountdown';
import { hasSeasonalContent } from '@/lib/seasonal-leaderboard';
import { hasHotStintQualifyingContent, hasJagoffContent } from '@/lib/acc/hot-stint-store';
import { resolveCarLogo } from '@/lib/acc/manufacturer-logo';
import { resolveAccTrackName } from '@/lib/acc/track-name';
import { EVENT_SOURCE_TIMEZONE } from '@/lib/event-time';
import { getCurrentPrequalEvent, getPrequalBoard, type PrequalBoard } from '@/lib/acc/prequal-store';
// showEndurance is forced true here — you're on the endurance page.

// Endurance pre-qualifying board. Laps arrive via the ACC cron (lib/acc/
// prequal-ingest.ts); standings are recomputed per render against current
// registrations (lib/acc/prequal-store.ts). Same cadence as the other boards.
export const revalidate = 300;

const CLASS_LABELS: Record<string, string> = { GT3: 'GT3', CUP: 'Porsche Cup', GT4: 'GT4' };

function fmt(ms: number): string {
  return msToLaptime(Math.round(ms)) ?? '—';
}

// The countdown component takes authored Eastern wall-clock strings.
function toEasternWallClock(iso: string): string {
  return formatInTimeZone(new Date(iso), EVENT_SOURCE_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
}

function closesLabel(iso: string): string {
  return formatInTimeZone(new Date(iso), EVENT_SOURCE_TIMEZONE, "EEE MMM d, h:mm a 'ET'");
}

export default async function EnduranceLeaderboardsPage({
  params,
}: {
  params: Promise<{ sim: string }>;
}) {
  const { sim: slug } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();
  // The Seasonal/Endurance split only applies to ACC (Team Series vs Endurance).
  if (sim.game !== 'ACC') notFound();

  const event = await getCurrentPrequalEvent();
  const board = event ? await getPrequalBoard(event) : null;

  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-7 pt-14 pb-24">
      <span
        className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5"
        style={{ color: 'var(--sim-accent)' }}
      >
        — <GameLabel game={sim.game} /> Leaderboards
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-16">
        Leaderboards
      </h1>

      <LeaderboardTabs
        simSlug={sim.slug}
        showSeasonal={await hasSeasonalContent()}
        showEndurance
        showHotStintQualifying={await hasHotStintQualifyingContent()}
        showJagoff={await hasJagoffContent()}
      />

      {board ? <PrequalBoardView board={board} simSlug={sim.slug} /> : <ComingSoon />}
    </section>
  );
}

function ComingSoon() {
  return (
    <div className="border border-line/50 bg-carbon-2 px-8 py-16 text-center">
      <p className="font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-4">Coming Soon</p>
      <p className="font-sans text-[15px] text-txt-2 leading-relaxed max-w-[620px] mx-auto">
        Endurance qualifying runs on a dedicated pre-qualification server. Once it opens, each
        driver&apos;s time here will be the <span className="text-txt">average of their best 3 valid laps</span> on
        the event track during the pre-qual window — not a single hot lap.
      </p>
      <a
        href="https://discord.gg/SimRacingAlliance"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block mt-6 font-mono text-[11px] tracking-[.2em] uppercase text-gold hover:text-gold-soft transition-colors"
      >
        Join Discord for pre-qual dates →
      </a>
    </div>
  );
}

function PrequalBoardView({ board, simSlug }: { board: PrequalBoard; simSlug: string }) {
  const { event, rows, isOpen } = board;
  const classes = [...new Set(rows.map((r) => r.entryClass))];
  const noTime = fmt(event.noTimeMs);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-[.3em] uppercase text-gold mb-2">
            Pre-Qualifying · {resolveAccTrackName(event.trackKey)}
          </p>
          <h2 className="font-display font-bold text-[clamp(26px,3.5vw,40px)] uppercase leading-none text-txt">
            {event.championshipTitle}
          </h2>
          <p className="font-mono text-[12px] text-txt-3 mt-3">
            {isOpen ? 'Closes' : 'Closed'} {closesLabel(event.closesAt)} · sets the starting grid
          </p>
        </div>
        {event.championshipSlug && (
          <Link
            href={`/${simSlug}/championships/${event.championshipSlug}/register`}
            className="font-mono text-[11px] tracking-[.2em] uppercase text-gold hover:text-gold-soft transition-colors"
          >
            Register / manage entry →
          </Link>
        )}
      </div>

      {isOpen && (
        <div className="mb-10 max-w-[560px]">
          <HotStintDeadlineCountdown
            deadlineIso={toEasternWallClock(event.closesAt)}
            opensIso={toEasternWallClock(event.opensAt)}
            label="Pre-qualifying closes in"
          />
        </div>
      )}

      {/* Format */}
      <ul className="border border-line bg-panel px-6 py-5 mb-12 space-y-1.5 font-sans text-[13px] text-txt-2 leading-relaxed">
        <li>
          Driver time = average of your <span className="text-txt">{event.lapsCounted} fastest valid laps</span> on the
          pre-qual server, in the car your entry is registered with.
        </li>
        <li>
          Missing laps count as <span className="text-txt">{noTime}</span> — no laps at all averages {noTime}.
        </li>
        <li>
          Team time = average of its drivers&apos; times. Can&apos;t race? Withdraw on the Register page so you
          don&apos;t count against your team.
        </li>
        <li>Grid is built class by class, fastest team first.</li>
      </ul>

      {rows.length === 0 ? (
        <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
          <p className="font-sans text-[15px] text-txt-2">
            No confirmed entries yet — teams appear here as soon as they register.
          </p>
        </div>
      ) : (
        classes.map((cls) => (
          <ClassTable
            key={cls}
            label={CLASS_LABELS[cls] ?? cls}
            rows={rows.filter((r) => r.entryClass === cls)}
            lapsCounted={event.lapsCounted}
          />
        ))
      )}
    </div>
  );
}

function ClassTable({
  label,
  rows,
  lapsCounted,
}: {
  label: string;
  rows: PrequalStandingRow[];
  lapsCounted: number;
}) {
  const leader = rows[0]?.teamAverageMs ?? 0;
  return (
    <div className="mb-12">
      <p className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-3 mb-3">
        {label} — {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
      </p>
      <div className="border border-line overflow-x-auto">
        <table className="w-full min-w-[680px] font-mono text-[13px]">
          <thead>
            <tr className="text-left text-[10px] tracking-[.2em] uppercase text-txt-3 border-b border-line">
              <th className="px-4 py-3 w-[60px]">Grid</th>
              <th className="px-4 py-3 w-[50px]">Pos</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Drivers</th>
              <th className="px-4 py-3 text-right">Team avg</th>
              <th className="px-4 py-3 text-right w-[100px]">Gap</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const logo = resolveCarLogo(r.carModelId);
              const gap = r.teamAverageMs - leader;
              return (
                <tr key={r.entryId} className="border-b border-line/30 last:border-b-0 align-top">
                  <td className="px-4 py-3 text-txt-3 tabular-nums">{r.gridPosition}</td>
                  <td className="px-4 py-3 text-gold font-bold tabular-nums">{r.classPosition}</td>
                  <td className="px-4 py-3">
                    <span className="block text-txt">{r.teamName}</span>
                    <span className="flex items-center gap-1.5 text-[11px] text-txt-3 mt-1">
                      {logo.manufacturerIconName && <CarIcon name={logo.manufacturerIconName} size={14} />}
                      {accCarModelName(r.carModelId) ?? `Car #${r.carModelId}`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1.5">
                      {r.drivers.map((d) => {
                        const short = d.bestLapsMs.length < lapsCounted;
                        return (
                          <div key={d.steamId} className="flex flex-wrap items-baseline gap-x-3">
                            <span className="text-txt-2 min-w-[140px]">{d.name}</span>
                            <span className={`tabular-nums ${short ? 'text-red-400' : 'text-txt'}`}>
                              {fmt(d.averageMs)}
                            </span>
                            <span className="text-[11px] text-txt-3 tabular-nums">
                              {d.bestLapsMs.length === 0
                                ? 'no laps yet'
                                : `${Math.min(d.bestLapsMs.length, lapsCounted)}/${lapsCounted}: ${d.bestLapsMs.map(fmt).join(' · ')}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-txt font-bold tabular-nums">
                    {fmt(r.teamAverageMs)}
                    {!r.complete && (
                      <span className="block text-[10px] font-normal tracking-[.1em] uppercase text-red-400 mt-1">
                        incomplete
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-txt-3 tabular-nums">
                    {r.classPosition === 1 ? '—' : `+${(gap / 1000).toFixed(3)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
