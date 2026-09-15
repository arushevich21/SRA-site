import type { ChampionshipContent } from '@/content/championships';
import type { StreamRound } from '@/lib/stream/overlay-data';
import { seasonShort } from '@/lib/stream/labels';
import { shortTrackName } from '@/components/RoundCells';

// Composited over ACC's own HUD: nothing but the label that says which race
// this is. Matches the "S19 | D2 | R7 - BRANDS HATCH" wording the crew used.
export function RaceInformationOverlay({
  championship,
  division,
  round,
}: {
  championship: ChampionshipContent;
  division: number | null;
  round: StreamRound | null;
}) {
  return (
    <div className="ov-race-label" role="status">
      <span className="is-gold">{seasonShort(championship)}</span>
      {division != null && <span>D{division}</span>}
      <span className="is-round">R{round?.round.round ?? '–'}</span>
      <span className="is-track">{round ? shortTrackName(round.round.track) : 'Track TBA'}</span>
    </div>
  );
}
