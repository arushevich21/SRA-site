// The commentary voice channels, and which division streams from which.
//
// SRA runs two concurrent broadcasts a night: the Twitch stream carries D1
// (Tuesday) and D2 (Wednesday), the YouTube stream carries D3 and D4 on the
// same nights. Each has its own booth channel on Discord, and SRA-Bot keeps
// the stream_booth row for each one current (migration 20260918_stream_booth).
//
// Channel ids are not secrets — they're in the StreamKit URLs the crew already
// runs — so they live here rather than in env.

export type Booth = 'twitch' | 'youtube';

export const BOOTH_CHANNELS: Record<Booth, string | null> = {
  twitch: '958805216218738708',
  youtube: '996204269348868156',
};

export function boothForDivision(division: number | null): Booth | null {
  if (division === 1 || division === 2) return 'twitch';
  if (division === 3 || division === 4) return 'youtube';
  return null;
}

export function boothChannelForDivision(division: number | null): string | null {
  const booth = boothForDivision(division);
  return booth ? BOOTH_CHANNELS[booth] : null;
}
