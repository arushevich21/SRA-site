import Image from 'next/image';
import type { ChampionshipContent } from '../../content/championships';
import { CategoryTag } from './shared';

export function RealChampionshipBlock({
  content,
}: {
  content: ChampionshipContent;
}) {
  const isComingSoon = content.schedule.length === 0;

  return (
    <article
      className={[
        'border p-8',
        isComingSoon ? 'border-line/50 bg-carbon-2' : 'border-line bg-panel',
      ].join(' ')}
    >
      {/* Tags row */}
      <div className="mb-5 flex items-center gap-3">
        <CategoryTag label={content.classTag} muted={isComingSoon} />
        <span
          className={[
            'font-mono text-[9px] tracking-[.25em] uppercase px-2 py-[2px] border',
            isComingSoon
              ? 'text-txt-3/60 border-txt-3/20'
              : 'text-txt-3 border-line',
          ].join(' ')}
        >
          {content.game}
        </span>
      </div>

      {/* Logo + info */}
      <div className="flex gap-7 flex-col sm:flex-row">
        {content.logo && (
          <Image
            src={content.logo}
            alt={content.title}
            width={148}
            height={148}
            className="w-[120px] h-[120px] shrink-0 object-contain self-start"
          />
        )}

        <div className="min-w-0 flex-1">
          <h2
            className={[
              'font-display font-black text-[clamp(28px,4vw,40px)] uppercase leading-none tracking-[-0.5px]',
              isComingSoon ? 'text-txt-2' : 'text-txt',
            ].join(' ')}
          >
            {content.title}
          </h2>

          <p className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-2 mt-3">
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
              <p className="font-mono text-[10px] tracking-[.2em] uppercase text-txt-3">
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
                className="font-mono text-[10px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
          {content.resultsUrl && (
            <a
              href={content.resultsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] tracking-[.15em] uppercase text-gold hover:text-gold-soft transition-colors flex items-center gap-2 shrink-0"
            >
              View on SimGrid →
            </a>
          )}
        </div>
      )}
    </article>
  );
}
