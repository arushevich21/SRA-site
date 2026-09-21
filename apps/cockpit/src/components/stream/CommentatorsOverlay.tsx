import type { BoothMember } from '@/lib/stream/overlay-data';

// How the lower-third paces itself when it isn't permanent: on air for
// HOLD seconds every EVERY seconds, fading FADE seconds in and out. It shows
// once as soon as the source loads (so a scene switch brings it in), then
// on the interval.
export const DEFAULT_LOWER_THIRD_EVERY_S = 5 * 60;
export const DEFAULT_LOWER_THIRD_HOLD_S = 10;
const FADE_S = 1;

export type LowerThirdCadence = { every: number; hold: number };

// ?every=<seconds between showings, 0 = always on>&hold=<seconds on air>
export function parseLowerThirdCadence(query: { every?: string; hold?: string }): LowerThirdCadence | null {
  const every = query.every === undefined ? DEFAULT_LOWER_THIRD_EVERY_S : Number.parseInt(query.every, 10);
  if (!Number.isFinite(every) || every <= 0) return null;
  const holdRaw = query.hold === undefined ? DEFAULT_LOWER_THIRD_HOLD_S : Number.parseInt(query.hold, 10);
  const hold = Number.isFinite(holdRaw) && holdRaw > 0 ? holdRaw : DEFAULT_LOWER_THIRD_HOLD_S;
  // The showing (fades included) has to fit inside the period.
  return { every: Math.max(every, hold + 2 * FADE_S + 1), hold };
}

// Transparent lower-third over the race feed. Renders nothing when the
// operator hasn't set a booth — a blank source beats a placeholder on air.
export function CommentatorsOverlay({
  commentators,
  cadence,
}: {
  commentators: BoothMember[];
  // Null keeps it on screen permanently.
  cadence: LowerThirdCadence | null;
}) {
  if (commentators.length === 0) return null;
  return (
    <>
      {cadence && <style>{cadenceKeyframes(cadence)}</style>}
      <div
        className={`ov-lower-third ${cadence ? 'is-timed' : ''}`}
        style={cadence ? { animationDuration: `${cadence.every}s` } : undefined}
        aria-label="Commentators"
      >
        <div className="ov-lower-third-kicker">
          <span className="ov-live-dot" aria-hidden="true" />
          Live from the booth
        </div>
        <div className="ov-lower-third-body">
          {commentators.map((c) => (
            <div key={c.name}>
              <b>{c.name}</b>
              <span>{c.role ?? 'Commentator'}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// One period of the cadence as keyframe percentages: fade in, hold, fade
// out, then off until the period ends. Keyframes can't read custom
// properties, so the percentages are computed here and emitted as a style.
function cadenceKeyframes({ every, hold }: LowerThirdCadence): string {
  const pct = (s: number) => `${((s / every) * 100).toFixed(4)}%`;
  const off = 'opacity: 0; transform: translateX(calc(-1.5 * var(--u)));';
  const on = 'opacity: 1; transform: none;';
  return `@keyframes ov-lower-third-cadence {
  0% { ${off} }
  ${pct(FADE_S)} { ${on} }
  ${pct(FADE_S + hold)} { ${on} }
  ${pct(2 * FADE_S + hold)} { ${off} }
  100% { ${off} }
}`;
}
