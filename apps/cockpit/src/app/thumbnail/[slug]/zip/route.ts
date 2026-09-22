import { NextResponse } from 'next/server';
import { getStreamChampionship, streamDivisionIds } from '@/lib/stream/overlay-data';
import { renderThumbnail, thumbnailFileName } from '@/lib/stream/thumbnail-render';
import { roundWeather } from '@/lib/stream/thumbnail-weather';
import { seasonShort } from '@/lib/stream/labels';
import { zipStore } from '@/lib/zip';

// Every round × division thumbnail for a series in one ZIP —
// /thumbnail/gt3-team-series-s19/zip → SRA_S19_thumbnails.zip. Rounds with a
// TBA track are skipped. Rendered in series to keep memory flat; a 32-image
// season takes a few seconds.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const championship = await getStreamChampionship(slug);
  if (!championship) return NextResponse.json({ error: 'unknown championship' }, { status: 404 });

  const divisionIds = streamDivisionIds(championship);
  const rounds = [...championship.schedule].sort((a, b) => a.round - b.round);
  const entries: { name: string; data: Uint8Array }[] = [];
  for (const round of rounds) {
    for (const divisionId of divisionIds) {
      const image = await renderThumbnail(championship, round, divisionId, roundWeather(slug, round.round));
      entries.push({
        name: thumbnailFileName(championship, round.round, divisionId),
        data: new Uint8Array(await image.arrayBuffer()),
      });
    }
  }

  const zip = zipStore(entries);
  return new NextResponse(new Blob([new Uint8Array(zip)], { type: 'application/zip' }), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="SRA_${seasonShort(championship)}_thumbnails.zip"`,
      'Cache-Control': 'no-store',
    },
  });
}
