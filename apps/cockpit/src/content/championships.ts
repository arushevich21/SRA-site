export type ScheduleRound = {
  round: number;
  track: string;
  date: string | null; // ISO datetime in local time (EDT), null = TBA
  raceLength: string;
  emperorTrack?: string; // exact "TrackName,Layout" string for Emperor's leaderboard ?track= param
  emperorRawTrackName?: string; // raw Emperor track_name for hot-lap cache lookups, e.g. "Road Atlanta"
};

export type ChampionshipContent = {
  simgridId: number | null;
  emperorChampionshipId?: string;
  standingsKey?: string;
  // Stable per-sim URL slug, e.g. /acc/championships/gt3-team-series-s19
  slug: string;
  game: 'ACC' | 'LMU' | 'AC Evo' | (string & {});
  classTag: string;
  formatTag?: string;
  // 'championship' (default) or 'exhibition' — shown as an extra tag chip.
  eventType?: 'championship' | 'exhibition';
  classes: string[];
  title: string;
  logo?: string;
  raceFormat: string;
  // Days/times racing happens, e.g. "Tuesday & Wednesday nights at 9:00 PM EDT" —
  // kept separate from raceFormat so the UI can show it on its own line.
  raceDays?: string;
  rulesBullets: string[];
  discordLinks: { label: string; url: string }[];
  resultsUrl: string | null;
  resultsLabel?: string; // defaults to "View on SimGrid" — override when resultsUrl points elsewhere
  schedule: ScheduleRound[];
  // Registration — only set on championships that accept team registration
  registrationKey?: string;      // stable slug stored in DB, e.g. 'acc-gt3-s19'
  registrationSeason?: string;   // DB season value, e.g. 's19'
  registrationOpen?: boolean;    // false/absent = form hidden
  maxTeamSize?: number;          // 2 for GT3 Sprint, 1-4 for Endurance
  allowedCars?: string[];        // car picker options
  // Forces "coming soon" display everywhere (championship cards, sim overview)
  // even if a real schedule is populated — for series teased ahead of launch.
  teaserOnly?: boolean;
  // Season has finished racing — forces "Concluded" display instead of Active.
  concluded?: boolean;
};

export function getStandingsKey(c: ChampionshipContent): string | undefined {
  return c.standingsKey ?? (c.simgridId != null ? String(c.simgridId) : undefined);
}

// Date and time split apart so callers (e.g. calendar rows) can give the
// date/time more visual weight than the surrounding duration/format text.
export function formatScheduleDateTime(date: string | null): { date: string; time: string | null } {
  if (!date) return { date: 'TBA', time: null };
  const hasTime = date.includes('T');
  const d = new Date(date);
  const dateStr = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  if (!hasTime) return { date: dateStr, time: null };
  const timeStr = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  return { date: dateStr, time: timeStr };
}

export function formatScheduleDate(date: string | null): string {
  const { date: dateStr, time } = formatScheduleDateTime(date);
  return time ? `${dateStr} · ${time}` : dateStr;
}

export const CHAMPIONSHIPS: ChampionshipContent[] = [
  {
    simgridId: null,
    slug: 'gt3-team-series-s19',
    game: 'ACC',
    classTag: 'GT3',
    formatTag: 'Sprint',
    classes: ['GT3'],
    title: 'GT3 Team Series — Season 19',
    logo: '/badges/gt3_team_series_logo.png',
    raceFormat: '60 min race · 10 min qualifying',
    raceDays: 'Tuesday & Wednesday nights at 9:00 PM EDT',
    rulesBullets: [
      'Divisions 1 & 3 race on Tuesday nights, Divisions 2 & 4 race on Wednesday nights',
      'Required pit stop with tire change, no refueling allowed (58 minute pit window)',
      'Qualifying requirement: 5-lap hot stint',
      'Sign-in required',
      'Stewarding: penalty submissions within 24 hours of race start',
      'The organizer reserves the right to apply a custom BoP (Balance of Performance)',
    ],
    discordLinks: [
      { label: 'Series Rules', url: 'https://discord.com/channels/915686674833498203/919069839476293683' },
      { label: 'Schedule', url: '/acc/championships/gt3-team-series-s19/calendar' },
      { label: 'Registration', url: '/acc/championships/gt3-team-series-s19/register' },
    ],
    resultsUrl: null,
    schedule: [],
    registrationKey: 'acc-gt3-s19',
    registrationSeason: 's19',
    registrationOpen: false,
    teaserOnly: true,
    maxTeamSize: 2,
    allowedCars: [
      'AMR V12 Vantage GT3',
      'AMR V8 Vantage GT3',
      'Audi R8 LMS GT3 Evo 2',
      'Bentley Continental GT3',
      'BMW M4 GT3',
      'BMW M6 GT3',
      'Emil Frey Jaguar G3',
      'Ferrari 296 GT3',
      'Ferrari 488 GT3 Evo',
      'Ford Mustang GT3',
      'Honda NSX GT3 Evo',
      'Lamborghini Huracán GT3 EVO2',
      'Lexus RC F GT3',
      'McLaren 650S GT3',
      'McLaren 720S GT3',
      'McLaren 720S GT3 Evo',
      'Mercedes-AMG GT3 EVO',
      'Nissan GT-R Nismo GT3',
      'Porsche 991 II GT3 R',
      'Porsche 992 GT3 R',
      'Reiter Engineering R-EX GT3',
    ],
  },
  {
    simgridId: null,
    standingsKey: 'endurance-s3',
    slug: 'gt3-endurance-s3',
    game: 'ACC',
    classTag: 'GT3',
    formatTag: 'Endurance',
    classes: ['GT3'],
    title: 'SRA GT3 Endurance Series — Season 3',
    logo: '/badges/endurance-series_logo.png',
    teaserOnly: true,
    raceFormat: '65 min stint timer · Refueling not fixed · Unlimited tires · Live stewarding',
    raceDays: 'Saturdays',
    rulesBullets: [
      '1–4 drivers per team',
      '3 divisions: Open, Silver, and Bronze',
      '65 minute stint timer, refueling time not fixed, unlimited tire sets',
      'Pre-qualification server opens ~4 weeks before each event',
      'Qualification: average of team\'s best 3 valid laps per driver',
      'Minimum qualifying time: 106% of pole position',
      'Points for pole position: 5 per class · Points for fastest lap: 5',
      'Teams with a member who does not qualify will be removed from the entry list',
      '5 at-fault penalties = disqualification (steward\'s discretion)',
      'Live stewarding with ticket system for non-contact incidents',
      'Custom BoP applies: simracingalliance.com/about/custom_bop',
    ],
    discordLinks: [
      { label: 'Series Rules', url: 'https://discord.com/channels/915686674833498203/919069800863514664' },
      { label: 'Schedule', url: '/acc/championships/gt3-endurance-s3/calendar' },
      { label: 'Registration', url: '/acc/championships/gt3-endurance-s3/register' },
    ],
    resultsUrl: null,
    schedule: [
      { round: 1, track: 'COTA', date: '2026-06-27T15:10:00', raceLength: '6h' },
      { round: 2, track: 'Hungaroring', date: '2026-08-01', raceLength: '6h' },
      { round: 3, track: 'Kyalami', date: '2026-09-12', raceLength: '9h' },
      { round: 4, track: 'Watkins Glen', date: '2026-10-10', raceLength: '6h' },
      { round: 5, track: 'Valencia', date: '2026-11-14', raceLength: '6h' },
      { round: 6, track: 'Silverstone', date: '2026-12-19', raceLength: '8h' },
    ],
  },
  {
    simgridId: 22872,
    slug: 'multiclass-mayhem-s3-split1',
    game: 'LMU',
    classTag: 'LMP2 / LMGT3',
    formatTag: 'Multiclass',
    classes: ['LMP2', 'LMGT3'],
    title: 'SRA Multiclass Mayhem - LMU - Season 3 Split 1',
    logo: '/badges/multiclass_mayhem_logo.png',
    concluded: true,
    raceFormat: '45–90 min race · 30 min practice (final 10 min drivers briefing) · 10 min solo qualifying',
    raceDays: 'Thursdays at 8:30 PM EDT',
    rulesBullets: [],
    discordLinks: [
      { label: 'Series Rules', url: 'https://discord.com/channels/915686674833498203/935279836396666930' },
      { label: 'Schedule', url: '/lmu/championships/multiclass-mayhem-s3-split1/calendar' },
      { label: 'Registration', url: '/lmu/championships/multiclass-mayhem-s3-split1/register' },
    ],
    resultsUrl: 'https://www.thesimgrid.com/championships/22872',
    resultsLabel: 'View on SimGrid',
    // Split 2 (ID 23700) is a separate championship — not wired yet
    schedule: [
      { round: 1, track: 'Fuji Classic', date: '2026-04-23T20:30:00', raceLength: '75 min' },
      { round: 2, track: 'Spa', date: '2026-04-30T20:30:00', raceLength: '60 min' },
      { round: 3, track: 'Brazil', date: '2026-05-07T20:30:00', raceLength: '45 min' },
      { round: 4, track: 'Le Mans', date: '2026-05-14T20:30:00', raceLength: '90 min' },
      { round: 5, track: 'Silverstone', date: '2026-05-21T20:30:00', raceLength: '60 min' },
      { round: 6, track: 'Qatar', date: '2026-06-04T20:30:00', raceLength: '60 min' },
      { round: 7, track: 'Algarve', date: '2026-06-11T20:30:00', raceLength: '45 min' },
      { round: 8, track: 'Barcelona', date: '2026-06-18T20:30:00', raceLength: '75 min' },
    ],
  },
  {
    simgridId: 25580,
    emperorChampionshipId: '3a2e4266-ff5f-4c5c-b575-2a268c75f7e7',
    slug: 'mx5-cup',
    game: 'AC Evo',
    classTag: 'MX-5',
    formatTag: 'Cup',
    classes: ['MX-5'],
    title: 'SRA MX5 Cup',
    logo: '/badges/SRA_MX5_Cup_logo_transparent.png',
    raceFormat: '30 min race · 20 min practice · 10 min qualifying',
    raceDays: 'Weekly at 9:00 PM EDT',
    rulesBullets: [
      'Points for pole position: 5 · Points for fastest lap: 5',
      'Practice server is live — search "SRA" in the AC Evo server browser: #SRAgg | Sim Racing Alliance | Main Server #1 | #SRAM1',
    ],
    discordLinks: [
      { label: 'Series Rules', url: '/about/rules' },
      { label: 'Schedule', url: '/acevo/championships/mx5-cup/calendar' },
      { label: 'Registration', url: '/acevo/championships/mx5-cup/register' },
    ],
    resultsUrl: '/acevo/championships/mx5-cup/standings',
    resultsLabel: 'View Standings',
    schedule: [
      { round: 1, track: 'Road Atlanta GP', date: '2026-06-29T21:00:00', raceLength: '30 min', emperorTrack: 'Road Atlanta,GP', emperorRawTrackName: 'Road Atlanta' },
      { round: 2, track: 'Sebring International Raceway GP', date: '2026-07-06T21:00:00', raceLength: '30 min', emperorTrack: 'Sebring International Raceway,GP', emperorRawTrackName: 'Sebring International Raceway' },
      { round: 3, track: 'Laguna Seca GP', date: '2026-07-13T21:00:00', raceLength: '30 min', emperorRawTrackName: 'Laguna Seca' },
      { round: 4, track: 'COTA National', date: '2026-07-20T21:00:00', raceLength: '30 min' },
    ],
  },
];
