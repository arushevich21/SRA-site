import { describe, it, expect } from 'vitest';
import { mapChampionship, type ChampionshipRow } from './championships-map.js';

function row(overrides: Partial<ChampionshipRow> = {}): ChampionshipRow {
  return {
    slug: 'test-series',
    game: 'ACC',
    title: 'Test Series',
    class_tag: 'GT3',
    format_tag: null,
    event_type: 'championship',
    classes: ['GT3'],
    logo_url: null,
    race_format: '60 min race',
    race_days: null,
    rules_bullets: [],
    discord_links: [],
    results_url: null,
    results_label: null,
    emperor_championship_id: null,
    simgrid_id: null,
    standings_key: null,
    registration_key: null,
    registration_season: null,
    registration_open: false,
    max_team_size: null,
    allowed_cars: null,
    teaser_only: false,
    concluded: false,
    sort_order: 0,
    championship_rounds: null,
    ...overrides,
  };
}

describe('mapChampionship', () => {
  it('maps required fields and leaves absent optionals undefined', () => {
    const c = mapChampionship(row());
    expect(c.slug).toBe('test-series');
    expect(c.classTag).toBe('GT3');
    expect(c.simgridId).toBeNull();
    expect(c.resultsUrl).toBeNull();
    expect(c.eventType).toBe('championship');
    // Null DB columns must not surface as null props — they should be absent.
    expect('formatTag' in c).toBe(false);
    expect('logo' in c).toBe(false);
    expect('emperorChampionshipId' in c).toBe(false);
    expect('standingsKey' in c).toBe(false);
    expect('maxTeamSize' in c).toBe(false);
  });

  it('maps present optional fields through', () => {
    const c = mapChampionship(
      row({
        format_tag: 'Sprint',
        logo_url: '/badges/x.png',
        emperor_championship_id: 'abc-123',
        standings_key: 'endurance-s3',
        max_team_size: 2,
        allowed_cars: ['Ferrari 296 GT3'],
        simgrid_id: 22872,
      }),
    );
    expect(c.formatTag).toBe('Sprint');
    expect(c.logo).toBe('/badges/x.png');
    expect(c.emperorChampionshipId).toBe('abc-123');
    expect(c.standingsKey).toBe('endurance-s3');
    expect(c.maxTeamSize).toBe(2);
    expect(c.allowedCars).toEqual(['Ferrari 296 GT3']);
    expect(c.simgridId).toBe(22872);
  });

  it('maps event_type "exhibition" and defaults anything else to championship', () => {
    expect(mapChampionship(row({ event_type: 'exhibition' })).eventType).toBe('exhibition');
    expect(mapChampionship(row({ event_type: 'championship' })).eventType).toBe('championship');
    expect(mapChampionship(row({ event_type: 'garbage' })).eventType).toBe('championship');
  });

  it('sorts rounds by round number and maps round fields', () => {
    const c = mapChampionship(
      row({
        championship_rounds: [
          { round: 2, track: 'Spa', race_length: '60 min', starts_at: '2026-05-01T20:00:00', emperor_track: null, emperor_raw_track_name: null },
          { round: 1, track: 'Monza', race_length: '45 min', starts_at: null, emperor_track: 'Monza,GP', emperor_raw_track_name: 'Monza' },
        ],
      }),
    );
    expect(c.schedule.map((r) => r.round)).toEqual([1, 2]);
    expect(c.schedule[0]).toMatchObject({
      round: 1,
      track: 'Monza',
      date: null,
      raceLength: '45 min',
      emperorTrack: 'Monza,GP',
      emperorRawTrackName: 'Monza',
    });
    // Round 2 has no Emperor track fields — they must be absent, not null.
    expect('emperorTrack' in c.schedule[1]).toBe(false);
    expect('emperorRawTrackName' in c.schedule[1]).toBe(false);
    expect(c.schedule[1].date).toBe('2026-05-01T20:00:00');
  });

  it('defaults null array columns to empty arrays', () => {
    const c = mapChampionship(row({ classes: null, rules_bullets: null, discord_links: null }));
    expect(c.classes).toEqual([]);
    expect(c.rulesBullets).toEqual([]);
    expect(c.discordLinks).toEqual([]);
    expect(c.schedule).toEqual([]);
  });
});
