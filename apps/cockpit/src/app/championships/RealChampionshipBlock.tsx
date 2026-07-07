import Image from 'next/image';
import Link from 'next/link';
import type { ChampionshipContent } from '../../content/championships';
import { SIMS } from '@/content/sims';
import { CategoryTag } from './shared';

export function RealChampionshipBlock({
  content,
}: {
  content: ChampionshipContent;
}) {
  const isComingSoon = content.schedule.length === 0;
  const simAccent = SIMS.find((s) => s.game === content.game)?.accentColor;

  return (
    <article
      className={[
        'relative border p-8',
        isComingSoon ? 'border-line bg-panel/60' : 'border-line bg-panel',
      ].join(' ')}
    >
      {/* Status badge */}
      <div className="absolute top-5 right-6 flex items-center gap-2">
        <span
          className={[
            'inline-block w-[7px] h-[7px] rounded-full',
            isComingSoon ? 'bg-txt-3/40' : 'bg-live',
          ].join(' ')}
          style={!isComingSoon ? { animation: 'live-pulse 1.8s infinite' } : undefined}
        />
        <span
          className={[
            'font-mono text-[11px] tracking-[.25em] uppercase',
            isComingSoon ? 'text-txt-3/50' : 'text-live',
          ].join(' ')}
        >
          {isComingSoon ? 'Upcoming' : 'Active'}
        </span>
      </div>

      {/* Tags row */}
      <div className="mb-5 flex items-center gap-3">
        <span
          className="font-mono text-[11px] tracking-[.25em] uppercase px-2 py-[2px] border"
          style={{
            color: simAccent ?? undefined,
            borderColor: simAccent ? `${simAccent}40` : undefined,
            opacity: isComingSoon ? 0.6 : 1,
          }}
        >
          {content.game}
        </span>
        <CategoryTag label={content.classTag} muted={isComingSoon} />
        {content.formatTag && (
          <span
            className={[
              'font-mono text-[11px] tracking-[.25em] uppercase px-2 py-[2px] border',
              isComingSoon ? 'text-txt-3/60 border-txt-3/20' : 'text-txt-3 border-line',
            ].join(' ')}
          >
            {content.formatTag}
          </span>
        )}
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
          <h2
            className={[
              'font-display font-black text-[clamp(28px,4vw,40px)] uppercase leading-none tracking-[-0.5px]',
              isComingSoon ? 'text-txt/70' : 'text-txt',
            ].join(' ')}
          >
            {content.title}
          </h2>

          <p className="font-mono text-[12px] tracking-[.3em] uppercase text-txt-2 mt-3">
            {content.schedule.length > 0 && (
              <>
                {content.schedule.length} Rounds
                <span className="text-txt-3"> · </span>
              </>
            )}
            {content.raceFormat}
          </p>

          {isComingSoon && (
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
      {(content.discordLinks.length > 0 || content.resultsUrl) && (
        <div className="mt-7 pt-5 border-t border-line flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-5 flex-wrap">
            {content.discordLinks.map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
          {content.resultsUrl && (
            content.resultsUrl.startsWith('/') ? (
              <Link
                href={content.resultsUrl}
                className="font-mono text-[12px] tracking-[.15em] uppercase text-gold hover:text-gold-soft transition-colors flex items-center gap-2 shrink-0"
              >
                {content.resultsLabel ?? 'View on Discord'} →
              </Link>
            ) : (
              <a
                href={content.resultsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[12px] tracking-[.15em] uppercase text-gold hover:text-gold-soft transition-colors flex items-center gap-2 shrink-0"
              >
                {content.resultsLabel ?? 'View on Discord'} →
              </a>
            )
          )}
        </div>
      )}
    </article>
  );
}
