import { NextResponse, type NextRequest } from 'next/server';
import { getSummary } from '@/lib/wrapped/snapshot';
import { renderLeaguePoster } from '@/lib/wrapped/league-poster';

// The league Wrapped poster (Season 19 champions) as a PNG.
//   /wrapped/s19/league/image              inline (link previews)
//   /wrapped/s19/league/image?download=1   as an attachment

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const league = await getSummary();
  if (!league) return NextResponse.json({ error: 'not generated yet' }, { status: 404 });
  const image = await renderLeaguePoster(league);
  image.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  if (request.nextUrl.searchParams.get('download')) {
    image.headers.set('Content-Disposition', 'attachment; filename="SRA_S19_Wrapped_Champions.png"');
  }
  return image;
}
