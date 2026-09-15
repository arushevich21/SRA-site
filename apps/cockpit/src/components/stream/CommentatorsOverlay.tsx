import type { BoothMember } from '@/lib/stream/overlay-data';

// Transparent lower-third over the race feed. Renders nothing when the
// operator hasn't set a booth — a blank source beats a placeholder on air.
export function CommentatorsOverlay({ commentators }: { commentators: BoothMember[] }) {
  if (commentators.length === 0) return null;
  return (
    <div className="ov-lower-third" aria-label="Commentators">
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
  );
}
