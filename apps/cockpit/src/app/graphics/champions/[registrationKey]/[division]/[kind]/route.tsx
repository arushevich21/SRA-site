import { NextResponse, type NextRequest } from 'next/server';
import { getDivisionChampions } from '@/lib/graphics/season-champions';
import {
  championFileName,
  renderChampion,
  type ChampionFormat,
  type ChampionKind,
} from '@/lib/graphics/champion-render';

// A season champion graphic as a PNG:
//
//   /graphics/champions/acc-gt3-s19/1/driver               square 1080×1080
//   /graphics/champions/acc-gt3-s19/1/team?format=wide     1920×1080
//   …?download=1                                           as an attachment
//
// /admin/champion-graphics lists every division × title × format.

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ registrationKey: string; division: string; kind: string }> },
) {
  const { registrationKey, division: divisionRaw, kind } = await params;
  const division = Number(divisionRaw);
  const season = Number(/-s(\d+)$/.exec(registrationKey)?.[1]);
  if (!Number.isInteger(division) || !Number.isInteger(season)) {
    return NextResponse.json({ error: 'expected /graphics/champions/<key ending -sN>/<division>/<driver|team>' }, { status: 400 });
  }
  if (kind !== 'driver' && kind !== 'team') {
    return NextResponse.json({ error: 'kind must be driver or team' }, { status: 400 });
  }
  const query = request.nextUrl.searchParams;
  const format: ChampionFormat = query.get('format') === 'wide' ? 'wide' : 'square';

  const champs = await getDivisionChampions(registrationKey, division);
  if (!champs || (kind === 'team' && !champs.team)) {
    return NextResponse.json({ error: 'no champion for that division/title' }, { status: 404 });
  }

  const image = await renderChampion(season, champs, kind as ChampionKind, format);
  // Browsers always revalidate (an hour's max-age kept showing stale art on
  // /admin/champion-graphics after a design change); the CDN keeps a day and
  // is purged on every deploy anyway.
  image.headers.set('Cache-Control', 'public, max-age=0, must-revalidate, s-maxage=86400');
  if (query.get('download')) {
    image.headers.set(
      'Content-Disposition',
      `attachment; filename="${championFileName(season, division, kind as ChampionKind, format)}"`,
    );
  }
  return image;
}
