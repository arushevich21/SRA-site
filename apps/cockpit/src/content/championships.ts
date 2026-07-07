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
  game: 'ACC' | 'LMU' | 'AC Evo' | (string & {});
  classTag: string;
  formatTag?: string;
  classes: string[];
  title: string;
  logo?: string;
  raceFormat: string;
  rulesBullets: string[];
  discordLinks: { label: string; url: string }[];
  resultsUrl: string | null;
  resultsLabel?: string; // defaults to "View on SimGrid" — override when resultsUrl points elsewhere
  schedule: ScheduleRound[];
};

export function getStandingsKey(c: ChampionshipContent): string | undefined {
  return c.standingsKey ?? (c.simgridId != null ? String(c.simgridId) : undefined);
}

export function formatScheduleDate(date: string | null): string {
  if (!date) return 'TBA';
  const hasTime = date.includes('T');
  const d = new Date(date);
  const dateStr = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  if (!hasTime) return dateStr;
  const timeStr = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  return `${dateStr} · ${timeStr}`;
}

export const CHAMPIONSHIPS: ChampionshipContent[] = [
  {
    simgridId: null,
    game: 'ACC',
    classTag: 'GT3',
    formatTag: 'Sprint',
    classes: ['GT3'],
    title: 'GT3 Team Series — Season 19',
    logo: '/badges/gt3_team_series_logo.png',
    raceFormat:
      '10 min qualifying · 60 min race · Tuesday & Wednesday nights at 9:00 PM EDT',
    rulesBullets: [
      'Divisions 1 & 3 race on Tuesday nights, Divisions 2 & 4 race on Wednesday nights',
      'Required pit stop with tire change, no refueling allowed (58 minute pit window)',
      'Qualifying requirement: 5-lap hot stint',
      'Sign-in required',
      'Stewarding: penalty submissions within 24 hours of race start',
      'The organizer reserves the right to apply a custom BoP (Balance of Performance)',
    ],
    discordLinks: [
      { label: 'Schedule', url: 'https://discord.com/channels/915686674833498203/918718571025145886' },
      { label: 'Series Rules', url: 'https://discord.com/channels/915686674833498203/919069839476293683' },
    ],
    resultsUrl: null,
    schedule: [],
  },
  {
    simgridId: null,
    standingsKey: 'endurance-s3',
    game: 'ACC',
    classTag: 'GT3',
    formatTag: 'Endurance',
    classes: ['GT3'],
    title: 'SRA GT3 Endurance Series — Season 3',
    logo: '/badges/endurance-series_logo.png',
    raceFormat:
      '65 min stint timer · Refueling not fixed · Unlimited tires · Live stewarding',
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
      { label: 'Registration', url: 'https://discord.com/channels/915686674833498203/921128147771092993' },
      { label: 'Series Rules', url: 'https://discord.com/channels/915686674833498203/919069800863514664' },
    ],
    resultsUrl: null,
    schedule: [
      { round: 1, track: 'Circuit of the Americas', date: '2026-06-27T15:10:00', raceLength: '6h' },
      { round: 2, track: 'Hungaroring', date: '2026-08-01', raceLength: '6h' },
      { round: 3, track: 'Kyalami', date: '2026-09-12', raceLength: '9h' },
      { round: 4, track: 'Watkins Glen', date: '2026-10-10', raceLength: '6h' },
      { round: 5, track: 'Valencia', date: '2026-11-14', raceLength: '6h' },
      { round: 6, track: 'Silverstone', date: '2026-12-19', raceLength: '8h' },
    ],
  },
  {
    simgridId: 22872,
    game: 'LMU',
    classTag: 'LMP2 / LMGT3',
    formatTag: 'Multiclass',
    classes: ['LMP2', 'LMGT3'],
    title: 'SRA Multiclass Mayhem - LMU - Season 3 Split 1',
    logo: '/badges/multiclass_mayhem_logo.png',
    raceFormat:
      '30 min practice (final 10 min drivers briefing) · 10 min solo qualifying · 45–90 min race',
    rulesBullets: [],
    discordLinks: [
      {
        label: 'Announcements',
        url: 'https://discord.com/channels/915686674833498203/1029145367268302858',
      },
    ],
    resultsUrl: 'https://www.thesimgrid.com/championships/22872/results',
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
    game: 'AC Evo',
    classTag: 'MX-5',
    formatTag: 'Cup',
    classes: ['MX-5'],
    title: 'SRA MX5 Cup',
    logo: '/badges/SRA_MX5_Cup_logo_transparent.png',
    raceFormat:
      '20 min practice · 10 min qualifying · 30 min race · Weekly at 9:00 PM EDT',
    rulesBullets: [
      'Points for pole position: 5 · Points for fastest lap: 5',
      'Practice server is live — search "SRA" in the AC Evo server browser: #SRAgg | Sim Racing Alliance | Main Server #1 | #SRAM1',
    ],
    discordLinks: [
      {
        label: 'Announcements',
        url: 'https://discord.com/channels/915686674833498203/915693003866275900/1520602621076045904'
      }
    ],
    resultsUrl: '/acevo/standings',
    resultsLabel: 'View Standings',
    schedule: [
      { round: 1, track: 'Road Atlanta GP', date: '2026-06-29T21:00:00', raceLength: '30 min', emperorTrack: 'Road Atlanta,GP', emperorRawTrackName: 'Road Atlanta' },
      { round: 2, track: 'Sebring International Raceway GP', date: '2026-07-06T21:00:00', raceLength: '30 min', emperorTrack: 'Sebring International Raceway,GP', emperorRawTrackName: 'Sebring International Raceway' },
      { round: 3, track: 'Laguna Seca GP', date: '2026-07-13T21:00:00', raceLength: '30 min' },
      { round: 4, track: 'Circuit of the Americas National', date: '2026-07-20T21:00:00', raceLength: '30 min' },
    ],
  },
];
