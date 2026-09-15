import { describe, it, expect } from 'vitest';
import { mapChampionship, type AccsmTargetRow, type ChampionshipRow } from './championships-map.js';
import { accsmChampionshipIds, isMultiDivision } from '../content/championships.js';

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
    max_registrations: null,
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
  it('omits accsmTargets entirely when the event has none', () => {
    const c = mapChampionship(row());
    expect('accsmTargets' in c).toBe(false);
    expect(isMultiDivision(c)).toBe(false);
  });

  it('maps division targets into division order regardless of row order', () => {
    // Deliberately out of order: PostgREST gives no ordering guarantee on a
    // secondary query, and the tab strip reads position 0 as "first division".
    const targets: AccsmTargetRow[] = [
      { division_id: 3, emperor_championship_id: 'guid-3', divisions: { name: 'Division 3' } },
      { division_id: 1, emperor_championship_id: 'guid-1', divisions: { name: 'Division 1' } },
      { division_id: 2, emperor_championship_id: 'guid-2', divisions: [{ name: 'Division 2' }] },
    ];
    const c = mapChampionship(row({ registration_key: 'acc-gt3-s19' }), targets);

    expect(c.accsmTargets?.map((t) => t.divisionId)).toEqual([1, 2, 3]);
    expect(c.accsmTargets?.map((t) => t.divisionName)).toEqual([
      'Division 1',
      'Division 2',
      'Division 3',
    ]);
    expect(accsmChampionshipIds(c)).toEqual(['guid-1', 'guid-2', 'guid-3']);
    expect(isMultiDivision(c)).toBe(true);
  });

  it('falls back to a synthetic division name when the join returns none', () => {
    const c = mapChampionship(row(), [
      { division_id: 4, emperor_championship_id: 'guid-4', divisions: null },
    ]);
    expect(c.accsmTargets?.[0].divisionName).toBe('Division 4');
  });

  it('prefers division targets over a stray single championship id', () => {
    // Belt-and-braces: saveChampionship rejects this combination, but a row
    // written before that validation existed must not silently render one
    // division's standings as the whole series'.
    const c = mapChampionship(row({ emperor_championship_id: 'single-guid' }), [
      { division_id: 1, emperor_championship_id: 'guid-1', divisions: null },
    ]);
    expect(accsmChampionshipIds(c)).toEqual(['guid-1']);
  });
});
