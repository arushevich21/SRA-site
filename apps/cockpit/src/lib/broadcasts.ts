export interface YouTubeBroadcast {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  embedUrl: string;
  externalUrl: string;
  platform: 'YouTube';
  publishedAt: string;
  formattedDate: string;
}

export const SRA_YOUTUBE_CHANNEL_ID = 'UCiDAEhPJIO6Zj1jP0cPFJqA';
export const SRA_YOUTUBE_FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${SRA_YOUTUBE_CHANNEL_ID}`;

export const FALLBACK_BROADCASTS: YouTubeBroadcast[] = [
  {
    id: 'XpitNeHPQT0',
    title: 'SRA GT3 Team Series — Division 2',
    subtitle: 'Sim Racing Alliance Live Stream',
    description:
      'Relive the high-speed competition, wheel-to-wheel battles, and tactical pit stop drama from the SRA GT3 Team Series championship.',
    embedUrl: 'https://www.youtube-nocookie.com/embed/XpitNeHPQT0',
    externalUrl: 'https://www.youtube.com/watch?v=XpitNeHPQT0',
    platform: 'YouTube',
    publishedAt: '2026-09-24T16:41:05+00:00',
    formattedDate: 'Recent Broadcast',
  },
  {
    id: '3YGzsSZMDa0',
    title: 'SRA GT3 Team Series — Division 4',
    subtitle: 'Sim Racing Alliance Live Stream',
    description:
      'Full race coverage with live commentary, broadcast overlays, and on-track action across all divisions.',
    embedUrl: 'https://www.youtube-nocookie.com/embed/3YGzsSZMDa0',
    externalUrl: 'https://www.youtube.com/watch?v=3YGzsSZMDa0',
    platform: 'YouTube',
    publishedAt: '2026-09-24T16:41:05+00:00',
    formattedDate: 'Recent Broadcast',
  },
];

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return 'Recent Broadcast';
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recent Broadcast';
  }
}

export function parseYouTubeFeed(xmlText: string, limit = 2): YouTubeBroadcast[] {
  const entries: YouTubeBroadcast[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;

  let match: RegExpExecArray | null;
  while ((match = entryRegex.exec(xmlText)) !== null && entries.length < limit) {
    const entryBlock = match[1];

    const videoIdMatch = entryBlock.match(/<yt:videoId>([\s\S]*?)<\/yt:videoId>/);
    const titleMatch = entryBlock.match(/<title>([\s\S]*?)<\/title>/);
    const publishedMatch = entryBlock.match(/<published>([\s\S]*?)<\/published>/);
    const descriptionMatch = entryBlock.match(/<media:description>([\s\S]*?)<\/media:description>/);

    const videoId = videoIdMatch ? videoIdMatch[1].trim() : '';
    if (!videoId) continue;

    const rawTitle = titleMatch ? titleMatch[1].trim() : 'Sim Racing Alliance Broadcast';
    const cleanTitle = decodeHtmlEntities(rawTitle);

    const rawDescription = descriptionMatch ? descriptionMatch[1].trim() : '';
    const cleanDescription = decodeHtmlEntities(rawDescription);
    // Take the first non-empty paragraph or clean snippet for display
    const firstParagraph = cleanDescription.split(/\n\s*\n/)[0]?.trim() || '';
    const description =
      firstParagraph.length > 280
        ? `${firstParagraph.slice(0, 277)}...`
        : firstParagraph || 'Official Sim Racing Alliance broadcast stream and race replay.';

    const publishedAt = publishedMatch ? publishedMatch[1].trim() : '';
    const formattedDate = publishedAt ? formatDate(publishedAt) : 'Recent Broadcast';

    entries.push({
      id: videoId,
      title: cleanTitle,
      subtitle: 'Sim Racing Alliance Broadcast',
      description,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      platform: 'YouTube',
      publishedAt,
      formattedDate,
    });
  }

  return entries;
}

export async function getLatestYouTubeBroadcasts(
  limit = 2,
  feedUrl = SRA_YOUTUBE_FEED_URL,
): Promise<YouTubeBroadcast[]> {
  try {
    const res = await fetch(feedUrl, {
      next: { revalidate: 1800 },
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SRA-Site/1.0)',
      },
    });

    if (!res.ok) {
      console.warn(`Failed to fetch YouTube RSS feed: ${res.status} ${res.statusText}`);
      return FALLBACK_BROADCASTS.slice(0, limit);
    }

    const xml = await res.text();
    const broadcasts = parseYouTubeFeed(xml, limit);

    if (broadcasts.length === 0) {
      return FALLBACK_BROADCASTS.slice(0, limit);
    }

    return broadcasts;
  } catch (error) {
    console.warn('Error fetching YouTube broadcast RSS feed, using fallback:', error);
    return FALLBACK_BROADCASTS.slice(0, limit);
  }
}
