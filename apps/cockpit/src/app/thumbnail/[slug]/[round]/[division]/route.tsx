import { NextResponse, type NextRequest } from 'next/server';
import { parseWeather } from '@/components/stream/RevealOverlay';
import { getStreamChampionship, streamDivisionIds } from '@/lib/stream/overlay-data';
import { renderThumbnail, thumbnailFileName } from '@/lib/stream/thumbnail-render';
import { roundWeather } from '@/lib/stream/thumbnail-weather';

// One race night's thumbnail as a 1280×720 PNG (see lib/stream/thumbnail-render):
//
//   /thumbnail/gt3-team-series-s19/3/2              round 3, division 2
//   /thumbnail/gt3-team-series-s19/3/2?weather=wet  override the weather badge
//   /thumbnail/gt3-team-series-s19/3/2?download=1   as an attachment
//
// /admin/thumbnails lists every round × division; /thumbnail/<slug>/zip
// bundles them.

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; round: string; division: string }> },
) {
  const { slug, round: roundRaw, division: divisionRaw } = await params;
  const roundNo = Number(roundRaw);
  const divisionId = Number(divisionRaw);
  if (!Number.isInteger(roundNo) || !Number.isInteger(divisionId)) {
    return NextResponse.json({ error: 'round and division must be integers' }, { status: 400 });
  }

  const championship = await getStreamChampionship(slug);
  if (!championship) return NextResponse.json({ error: 'unknown championship' }, { status: 404 });
  const round = championship.schedule.find((r) => r.round === roundNo);
  if (!round) return NextResponse.json({ error: 'unknown round' }, { status: 404 });
  if (!streamDivisionIds(championship).includes(divisionId)) {
    return NextResponse.json({ error: 'unknown division' }, { status: 404 });
  }

  const query = request.nextUrl.searchParams;
  const weather = parseWeather(query.get('weather') ?? undefined) ?? roundWeather(slug, roundNo);
  const image = await renderThumbnail(championship, round, divisionId, weather);
  image.headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600');
  if (query.get('download')) {
    image.headers.set(
      'Content-Disposition',
      `attachment; filename="${thumbnailFileName(championship, roundNo, divisionId)}"`,
    );
  }
  return image;
}
