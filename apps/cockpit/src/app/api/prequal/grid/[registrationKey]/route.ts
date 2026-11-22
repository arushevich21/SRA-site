import { NextResponse } from 'next/server';
import { getPrequalBoard, getPrequalEventByRegistrationKey } from '@/lib/acc/prequal-store';

// Pre-qualifying starting grid for a championship, by registration key —
// read by SRA-Bot when it builds the ACCSM entry list, which writes each car's
// defaultGridPosition from it (app/util/accsm/prequal_grid.py there).
//
// The grid comes from the same computation as the public board
// (/acc/leaderboards/endurance), so the bot never re-implements the scoring.
// Public: every value here is already on that page. 404 = no pre-qual for
// this key (the GT3 Team Series, LIAW) — the bot then leaves the grid alone.
//
// Always fresh: the bot asks right after a roster change or a new batch of
// pre-qual laps, and a cached grid would push a stale order to ACCSM.
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ registrationKey: string }> },
): Promise<NextResponse> {
  const { registrationKey } = await params;
  const event = await getPrequalEventByRegistrationKey(registrationKey);
  if (!event) {
    return NextResponse.json({ error: 'no pre-qualifying for this registration key' }, { status: 404 });
  }

  const { rows, isOpen } = await getPrequalBoard(event);
  return NextResponse.json({
    registration_key: registrationKey,
    event_id: event.id,
    closes_at: event.closesAt,
    closed: !isOpen,
    grid: rows.map((r) => ({
      registration_id: r.entryId,
      grid_position: r.gridPosition,
      class: r.entryClass,
      class_position: r.classPosition,
      team_name: r.teamName,
      team_average_ms: Math.round(r.teamAverageMs),
      complete: r.complete,
    })),
  });
}
