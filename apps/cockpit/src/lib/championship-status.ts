import type { ChampionshipContent } from '@/content/championships';
import { eventInstant } from '@/lib/event-time';

export type ChampionshipStatus =
  | 'concluded'
  | 'coming-soon'
  | 'upcoming'
  | 'active-open'
  | 'active-closed';

export const CHAMPIONSHIP_STATUS_LABELS: Record<ChampionshipStatus, string> = {
  concluded: 'Concluded',
  'coming-soon': 'Coming Soon',
  upcoming: 'Upcoming',
  'active-open': 'Active — Open',
  'active-closed': 'Active — Closed',
};

export function getChampionshipStatus(content: ChampionshipContent): ChampionshipStatus {
  if (content.concluded) return 'concluded';
  if (content.teaserOnly || content.schedule.length === 0) return 'coming-soon';

  const firstRoundDate = content.schedule.find((r) => r.date)?.date;
  if (firstRoundDate && eventInstant(firstRoundDate) > Date.now()) return 'upcoming';

  // The open/closed distinction only makes sense for series that gate entry
  // behind team registration. Series without one (e.g. a drop-in cup) are
  // simply "active" — default that to the open state rather than "closed",
  // which would wrongly imply registration existed and was shut.
  if (!content.registrationKey) return 'active-open';
  return content.registrationOpen ? 'active-open' : 'active-closed';
}
