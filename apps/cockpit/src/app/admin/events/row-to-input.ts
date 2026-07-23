import type { ChampionshipRow } from '@/lib/championships-map';
import type { ChampionshipInput } from './actions';

// DB row -> the form's working shape. NULLs become '' (empty inputs); the
// rounds array is sorted and its NULLs likewise blanked.
export function rowToInput(row: ChampionshipRow & { id: string }): ChampionshipInput {
  return {
    id: row.id,
    slug: row.slug,
    game: row.game,
    title: row.title,
    classTag: row.class_tag,
    formatTag: row.format_tag ?? '',
    eventType: row.event_type === 'exhibition' ? 'exhibition' : 'championship',
    classes: row.classes ?? [],
    logoUrl: row.logo_url ?? '',
    raceFormat: row.race_format,
    raceDays: row.race_days ?? '',
    rulesBullets: row.rules_bullets ?? [],
    discordLinks: row.discord_links ?? [],
    resultsUrl: row.results_url ?? '',
    resultsLabel: row.results_label ?? '',
    emperorChampionshipId: row.emperor_championship_id ?? '',
    simgridId: row.simgrid_id != null ? String(row.simgrid_id) : '',
    standingsKey: row.standings_key ?? '',
    registrationKey: row.registration_key ?? '',
    registrationSeason: row.registration_season ?? '',
    registrationOpen: row.registration_open,
    maxTeamSize: row.max_team_size != null ? String(row.max_team_size) : '',
    allowedCars: row.allowed_cars ?? [],
    teaserOnly: row.teaser_only,
    concluded: row.concluded,
    sortOrder: row.sort_order,
    rounds: (row.championship_rounds ?? [])
      .slice()
      .sort((a, b) => a.round - b.round)
      .map((r) => ({
        round: r.round,
        track: r.track,
        raceLength: r.race_length,
        startsAt: r.starts_at ?? '',
        emperorTrack: r.emperor_track ?? '',
        emperorRawTrackName: r.emperor_raw_track_name ?? '',
      })),
  };
}
