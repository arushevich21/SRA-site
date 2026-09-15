import type { ChampionshipContent } from '@/content/championships';
import { eventDateTimeParts } from '@/lib/event-time';
import type { StreamRound } from '@/lib/stream/overlay-data';
import { seasonLabel } from '@/lib/stream/labels';
import { OverlayFoot, OverlayFrame, OverlayLockup } from './OverlayPrimitives';
import { isTbaTrack, trackMapUrl } from './track-maps';

export function CalendarOverlay({
  championship,
  division,
  rounds,
}: {
  championship: ChampionshipContent;
  division: number | null;
  rounds: StreamRound[];
}) {
  const current = rounds.find((r) => r.isCurrent) ?? null;
  const currentIndex = current ? rounds.indexOf(current) : -1;

  return (
    <OverlayFrame ticker>
      <OverlayLockup
        championship={championship}
        title={`${seasonLabel(championship)} Calendar`}
        subtitle={`${rounds.length}-round season · ${championship.raceDays ?? championship.raceFormat}`}
        division={division}
        round={current}
      />

      <div className="ov-calendar">
        {rounds.slice(0, 8).map((r, i) => {
          const tba = isTbaTrack(r.round.track);
          const map = tba ? null : trackMapUrl(r.round.track);
          const when = eventDateTimeParts(r.startsAt, 'America/New_York');
          const state = r.isCurrent ? 'is-current' : i < currentIndex ? 'is-past' : '';
          return (
            <article className={`ov-round ${state}`} key={r.round.round}>
              {r.isCurrent && <span className="ov-round-tag">This week</span>}
              <div className="ov-round-head">
                <b>R{r.round.round}</b>
                <strong className={tba ? 'is-tba' : ''}>{tba ? 'Track TBA' : r.round.track}</strong>
              </div>
              <div className="ov-round-map">
                {map ? (
                  // eslint-disable-next-line @next/next/no-img-element -- static map art
                  <img src={map} alt={`${r.round.track} circuit map`} />
                ) : (
                  <span>{tba ? 'TBA' : 'NO MAP'}</span>
                )}
              </div>
              <div className="ov-round-date">
                <strong>{when.date}</strong>
                <span>{when.time ?? r.round.raceLength}</span>
              </div>
            </article>
          );
        })}
      </div>

      <OverlayFoot
        left={
          <>
            All times Eastern{championship.raceDays ? ` · ${championship.raceDays}` : ''}
          </>
        }
        right="simracingalliance.com/acc/calendar"
      />
    </OverlayFrame>
  );
}
