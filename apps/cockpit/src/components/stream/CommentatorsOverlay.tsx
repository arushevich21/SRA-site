import { OverlayPanel } from './OverlayPrimitives';
import { MOCK_COMMENTATORS } from './commentator-data';

export function CommentatorsOverlay() {
  return (
    <div className="stream-commentator-booth" aria-label="Commentator booth">
      <div className="stream-commentator-kicker">LIVE FROM THE BOOTH</div>
      <OverlayPanel className="stream-commentator-panel">
        <div className="stream-commentator-heading">
          <span>COMMENTATORS</span>
          <span className="stream-commentator-live-dot" aria-hidden="true" />
        </div>
        <div className="stream-commentator-list">
          {MOCK_COMMENTATORS.map((commentator) => (
            <div className="stream-commentator" key={commentator.name}>
              <span className="stream-commentator-copy">
                <strong>{commentator.name}</strong>
                <small>{commentator.role}</small>
              </span>
            </div>
          ))}
        </div>
      </OverlayPanel>
    </div>
  );
}
