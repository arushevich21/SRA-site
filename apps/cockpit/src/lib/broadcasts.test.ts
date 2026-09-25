import { describe, expect, it } from 'vitest';
import {
  FALLBACK_BROADCASTS,
  parseYouTubeFeed,
  SRA_YOUTUBE_CHANNEL_ID,
  SRA_YOUTUBE_FEED_URL,
} from './broadcasts';

const SAMPLE_FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <link rel="self" href="http://www.youtube.com/feeds/videos.xml?channel_id=UCiDAEhPJIO6Zj1jP0cPFJqA"/>
 <id>yt:channel:UCiDAEhPJIO6Zj1jP0cPFJqA</id>
 <yt:channelId>UCiDAEhPJIO6Zj1jP0cPFJqA</yt:channelId>
 <title>Sim Racing Alliance</title>
 <link rel="alternate" href="https://www.youtube.com/channel/UCiDAEhPJIO6Zj1jP0cPFJqA"/>
 <author>
  <name>Sim Racing Alliance</name>
  <uri>https://www.youtube.com/channel/UCiDAEhPJIO6Zj1jP0cPFJqA</uri>
 </author>
 <published>2021-04-10T19:00:00+00:00</published>
 <entry>
  <id>yt:video:XpitNeHPQT0</id>
  <yt:videoId>XpitNeHPQT0</yt:videoId>
  <yt:channelId>UCiDAEhPJIO6Zj1jP0cPFJqA</yt:channelId>
  <title>SRA | S19 R1 | D2 | Silverstone &amp; Spa</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=XpitNeHPQT0"/>
  <published>2026-09-24T16:41:05+00:00</published>
  <updated>2026-09-24T20:41:31+00:00</updated>
  <media:group>
   <media:title>SRA | S19 R1 | D2 | Silverstone &amp; Spa</media:title>
   <media:thumbnail url="https://i1.ytimg.com/vi/XpitNeHPQT0/hqdefault.jpg" width="480" height="360"/>
   <media:description>Sim Racing Alliance (SRA) – NA ACC PC League
Website: https://www.simracingalliance.com/
Discord: https://discord.gg/simracingalliance

We are a North American based Sim Racing Community!</media:description>
  </media:group>
 </entry>
 <entry>
  <yt:videoId>3YGzsSZMDa0</yt:videoId>
  <title>SRA | S19 R1 | D4 | Silverstone</title>
  <published>2026-09-23T12:00:00+00:00</published>
  <media:group>
   <media:description>Division 4 action live from Silverstone.</media:description>
  </media:group>
 </entry>
 <entry>
  <yt:videoId>sDBdxoVIIOU</yt:videoId>
  <title>SRA | S19 | Schedule &amp; Livery Reveal Stream</title>
  <published>2026-09-20T18:00:00+00:00</published>
 </entry>
</feed>`;

describe('YouTube broadcasts feed parser', () => {
  it('has correct SRA channel configuration', () => {
    expect(SRA_YOUTUBE_CHANNEL_ID).toBe('UCiDAEhPJIO6Zj1jP0cPFJqA');
    expect(SRA_YOUTUBE_FEED_URL).toContain(SRA_YOUTUBE_CHANNEL_ID);
    expect(FALLBACK_BROADCASTS.length).toBeGreaterThanOrEqual(2);
  });

  it('parses valid XML feed entries up to the limit', () => {
    const broadcasts = parseYouTubeFeed(SAMPLE_FEED_XML, 2);

    expect(broadcasts).toHaveLength(2);
    expect(broadcasts[0]).toEqual({
      id: 'XpitNeHPQT0',
      title: 'SRA | S19 R1 | D2 | Silverstone & Spa',
      subtitle: 'Sim Racing Alliance Broadcast',
      description: expect.stringContaining('Sim Racing Alliance (SRA) – NA ACC PC League'),
      embedUrl: 'https://www.youtube-nocookie.com/embed/XpitNeHPQT0',
      externalUrl: 'https://www.youtube.com/watch?v=XpitNeHPQT0',
      platform: 'YouTube',
      publishedAt: '2026-09-24T16:41:05+00:00',
      formattedDate: expect.any(String),
    });

    expect(broadcasts[1].id).toBe('3YGzsSZMDa0');
    expect(broadcasts[1].title).toBe('SRA | S19 R1 | D4 | Silverstone');
  });

  it('handles empty or malformed XML gracefully', () => {
    expect(parseYouTubeFeed('')).toEqual([]);
    expect(parseYouTubeFeed('<feed><title>No entries</title></feed>')).toEqual([]);
  });
});
