import { NextResponse, type NextRequest } from 'next/server';
import { getCardByToken } from '@/lib/wrapped/snapshot';
import { renderWrappedPoster } from '@/lib/wrapped/poster-image';

// The share poster PNG for one card (token = the share link's token).
//   /wrapped/s19/s/<token>/image              inline (link previews)
//   /wrapped/s19/s/<token>/image?download=1   as an attachment

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const card = await getCardByToken(token);
  if (!card) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const image = await renderWrappedPoster(card);
  // The snapshot only changes when an admin regenerates it.
  image.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  image.headers.set('X-Robots-Tag', 'noindex');
  if (request.nextUrl.searchParams.get('download')) {
    const safe = card.name.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'driver';
    image.headers.set('Content-Disposition', `attachment; filename="SRA_S19_Wrapped_${safe}.png"`);
  }
  return image;
}
