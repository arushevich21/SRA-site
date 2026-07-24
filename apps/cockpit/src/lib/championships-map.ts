import type { ChampionshipContent, ScheduleRound } from '@/content/championships';

// Pure DB-row -> ChampionshipContent mapping, split out from
// championships-store.ts (which is server-only) so it's unit-testable.

export type ChampionshipRoundRow = {
  round: number;
  track: string;
  race_length: string;
  starts_at: string | null;
  emperor_track: string | null;
  emperor_raw_track_name: string | null;
  hotlap_released?: boolean;
};

export type ChampionshipRow = {
  slug: string;
  game: string;
  title: string;
  class_tag: string;
  format_tag: string | null;
  event_type: string;
  classes: string[] | null;
  logo_url: string | null;
  race_format: string;
  race_days: string | null;
  rules_bullets: string[] | null;
  discord_links: { label: string; url: string }[] | null;
  results_url: string | null;
  results_label: string | null;
  emperor_championship_id: string | null;
  simgrid_id: number | null;
  standings_key: string | null;
  registration_key: string | null;
  registration_season: string | null;
  registration_open: boolean;
  max_team_size: number | null;
  allowed_cars: string[] | null;
  teaser_only: boolean;
  concluded: boolean;
  sort_order: number;
  championship_rounds: ChampionshipRoundRow[] | null;
};

export function mapRound(r: ChampionshipRoundRow): ScheduleRound {
  return {
    round: r.round,
    track: r.track,
    date: r.starts_at,
    raceLength: r.race_length,
    ...(r.emperor_track ? { emperorTrack: r.emperor_track } : {}),
    ...(r.emperor_raw_track_name ? { emperorRawTrackName: r.emperor_raw_track_name } : {}),
    ...(r.hotlap_released ? { hotlapReleased: true } : {}),
  };
}

export function mapChampionship(row: ChampionshipRow): ChampionshipContent {
  const schedule = (row.championship_rounds ?? [])
    .slice()
    .sort((a, b) => a.round - b.round)
    .map(mapRound);

  return {
    simgridId: row.simgrid_id,
    slug: row.slug,
    game: row.game,
    title: row.title,
    classTag: row.class_tag,
    classes: row.classes ?? [],
    eventType: row.event_type === 'exhibition' ? 'exhibition' : 'championship',
    raceFormat: row.race_format,
    rulesBullets: row.rules_bullets ?? [],
    discordLinks: row.discord_links ?? [],
    resultsUrl: row.results_url,
    registrationOpen: row.registration_open,
    teaserOnly: row.teaser_only,
    concluded: row.concluded,
    schedule,
    ...(row.format_tag ? { formatTag: row.format_tag } : {}),
    ...(row.logo_url ? { logo: row.logo_url } : {}),
    ...(row.race_days ? { raceDays: row.race_days } : {}),
    ...(row.results_label ? { resultsLabel: row.results_label } : {}),
    ...(row.emperor_championship_id ? { emperorChampionshipId: row.emperor_championship_id } : {}),
    ...(row.standings_key ? { standingsKey: row.standings_key } : {}),
    ...(row.registration_key ? { registrationKey: row.registration_key } : {}),
    ...(row.registration_season ? { registrationSeason: row.registration_season } : {}),
    ...(row.max_team_size != null ? { maxTeamSize: row.max_team_size } : {}),
    ...(row.allowed_cars ? { allowedCars: row.allowed_cars } : {}),
  };
}
