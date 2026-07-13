import Image from 'next/image';
import Link from 'next/link';
import type { ChampionshipContent } from '../../content/championships';
import { formatScheduleDateTime } from '../../content/championships';
import { SIMS } from '@/content/sims';
import { CategoryTag } from './shared';
import { getChampionshipStatus, CHAMPIONSHIP_STATUS_LABELS } from '@/lib/championship-status';
import { GameLabel } from '@/components/GameLabel';

const STATUS_DOT_CLASS: Record<string, string> = {
  concluded: 'bg-concluded',
  'coming-soon': 'bg-txt-3/40',
  upcoming: 'bg-txt-3/40',
  'active-open': 'bg-live',
  'active-closed': 'bg-active-closed',
};

const STATUS_TEXT_CLASS: Record<string, string> = {
  concluded: 'text-concluded',
  'coming-soon': 'text-txt-3/50',
  upcoming: 'text-txt-3/50',
  'active-open': 'text-live',
  'active-closed': 'text-active-closed',
};

export function RealChampionshipBlock({
  content,
  href,
}: {
  content: ChampionshipContent;
  href?: string;
}) {
  const status = getChampionshipStatus(content);
  const isActive = status === 'active-open' || status === 'active-closed';
  const isDimmed = !isActive;
  const sim = SIMS.find((s) => s.game === content.game);
  const simAccent = sim?.accentColor;

  // Every championship gets a standings CTA — its own results page/link when
  // it has one, otherwise a fallback to this championship's own standings tab.
  const standingsHref =
    content.resultsUrl ?? (sim ? `/${sim.slug}/championships/${content.slug}/standings` : null);
  const standingsLabel = content.resultsUrl ? (content.resultsLabel ?? 'View Results') : 'View Standings';
  const standingsExternal = content.resultsUrl ? !content.resultsUrl.startsWith('/') : false;

  return (
    <article
      className={[
        'relative border p-8',
        isDimmed ? 'border-line bg-panel/60' : 'border-line bg-panel',
      ].join(' ')}
    >
      {/* Status badge */}
      <div className="absolute top-5 right-6 flex items-center gap-2">
        <span
          className={['inline-block w-[7px] h-[7px] rounded-full', STATUS_DOT_CLASS[status]].join(' ')}
          style={status === 'active-open' ? { animation: 'live-pulse 1.8s infinite' } : undefined}
        />
        <span className={['font-mono text-[11px] tracking-[.25em] uppercase', STATUS_TEXT_CLASS[status]].join(' ')}>
          {CHAMPIONSHIP_STATUS_LABELS[status]}
        </span>
      </div>

      {/* Logo + info */}
      <div className="flex gap-7 flex-col sm:flex-row">
        {content.logo && (
          <Image
            src={content.logo}
            alt={content.title}
            width={280}
            height={280}
            className="w-[220px] h-[220px] shrink-0 object-contain self-start"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2
              className={[
                'font-display font-black text-[clamp(28px,4vw,40px)] uppercase leading-none tracking-[-0.5px]',
                isDimmed ? 'text-txt/70' : 'text-txt',
              ].join(' ')}
            >
              {href ? (
                <Link href={href} className="hover:text-gold transition-colors">
                  {content.title}
                </Link>
              ) : (
                content.title
              )}
            </h2>
            <span
              className="font-mono text-[11px] tracking-[.25em] uppercase px-2 py-[2px] border"
              style={{
                color: simAccent ?? undefined,
                borderColor: simAccent ? `${simAccent}40` : undefined,
                opacity: isDimmed ? 0.6 : 1,
              }}
            >
              <GameLabel game={content.game} />
            </span>
            <CategoryTag label={content.classTag} muted={isDimmed} />
            {content.formatTag && (
              <span
                className={[
                  'font-mono text-[11px] tracking-[.25em] uppercase px-2 py-[2px] border',
                  isDimmed ? 'text-txt-3/60 border-txt-3/20' : 'text-txt-3 border-line',
                ].join(' ')}
              >
                {content.formatTag}
              </span>
            )}
            {content.eventType === 'exhibition' && (
              <span
                className={[
                  'font-mono text-[11px] tracking-[.25em] uppercase px-2 py-[2px] border',
                  isDimmed ? 'text-txt-3/60 border-txt-3/20' : 'text-txt-3 border-line',
                ].join(' ')}
              >
                Exhibition
              </span>
            )}
          </div>

          <div className="mt-3 space-y-1">
            <p className="font-mono text-[12px] tracking-[.3em] uppercase text-txt-2">
              {content.schedule.length > 0 && status !== 'coming-soon' && (
                <>
                  {content.schedule.length} Rounds
                  <span className="text-txt-3"> · </span>
                </>
              )}
              {content.raceDays}
            </p>
            <p className="font-mono text-[11px] tracking-[.25em] uppercase text-txt-3">
              {content.raceFormat}
            </p>
          </div>

          {/* Don't leak the schedule for series that haven't been officially announced yet */}
          {content.schedule.length > 0 && status !== 'coming-soon' && (
            <div className="mt-5 border border-line/60 bg-carbon-2/40">
              {content.schedule.map((round, i) => {
                const { date: dateStr, time: timeStr } = formatScheduleDateTime(round.date);
                return (
                  <div
                    key={round.round}
                    className={[
                      'flex items-center gap-4 px-4 py-[9px]',
                      i < content.schedule.length - 1 ? 'border-b border-line/40' : '',
                    ].join(' ')}
                  >
                    <span className="font-mono text-[12px] tracking-[.15em] uppercase text-gold w-8 shrink-0">
                      R{round.round}
                    </span>
                    <span className="font-sans text-[13px] text-txt-2 flex-1 min-w-0 truncate">
                      {round.track}
                    </span>
                    <span className="flex flex-col items-end shrink-0 leading-tight">
                      <span className="font-display font-bold text-[12px] uppercase text-txt">
                        {dateStr}
                      </span>
                      {timeStr && (
                        <span className="font-mono text-[11px] text-txt-3">{timeStr}</span>
                      )}
                    </span>
                    <span className="font-mono text-[10px] tracking-[.1em] uppercase text-txt-3/70 shrink-0 w-14 text-right">
                      {round.raceLength}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {status === 'coming-soon' && (
            <div className="mt-5 border border-line/50 px-4 py-3">
              <p className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3">
                Coming Soon
              </p>
            </div>
          )}

          {content.rulesBullets.length > 0 && (
            <ul className="mt-4 space-y-[6px]">
              {content.rulesBullets.map((rule) => (
                <li
                  key={rule}
                  className="flex gap-3 font-sans text-sm text-txt-2 leading-snug"
                >
                  <span className="shrink-0 mt-px select-none text-gold">—</span>
                  {rule}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      {(content.discordLinks.length > 0 || standingsHref) && (
        <div className="mt-7 pt-5 border-t border-line flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            {content.discordLinks.map((link) => {
              const btnClass =
                'font-mono text-[11px] tracking-[.15em] uppercase px-3 py-[7px] border border-line text-txt-2 hover:border-gold hover:text-gold transition-colors';
              return link.url.startsWith('/') ? (
                <Link key={link.label} href={link.url} className={btnClass}>
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={btnClass}
                >
                  {link.label}
                </a>
              );
            })}
          </div>
          {standingsHref && (
            standingsExternal ? (
              <a
                href={standingsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[12px] tracking-[.15em] uppercase px-4 py-[9px] bg-gold text-carbon font-bold hover:bg-gold-soft transition-colors flex items-center gap-2 shrink-0"
              >
                {standingsLabel} →
              </a>
            ) : (
              <Link
                href={standingsHref}
                className="font-mono text-[12px] tracking-[.15em] uppercase px-4 py-[9px] bg-gold text-carbon font-bold hover:bg-gold-soft transition-colors flex items-center gap-2 shrink-0"
              >
                {standingsLabel} →
              </Link>
            )
          )}
        </div>
      )}
    </article>
  );
}
