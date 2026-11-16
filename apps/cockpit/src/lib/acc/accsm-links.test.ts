import { describe, expect, it } from 'vitest';
import { accsmHostForServerName, accsmResultPageUrl } from './accsm-links';

// Fixtures are real rows from acc_race_sessions, and each expected URL was
// checked by hand against the live ACCSM hosts (200 on the right host, 404 on
// the other) on 2026-11-16.
const D1 = '#SRAggTT | TT | Division 1 | Season 19 | GT3 Team Championship | SimRacingAlliance.com | SRAM1 | cBOP';
const D3 = '#SRAggTT | TT | Division 3 | Season 19 | GT3 Team Championship | SimRacingAlliance.com | SRAM2 | cBOP';

describe('accsmHostForServerName', () => {
  it('puts odd SRAM slots on accsm1 and even ones on accsm2', () => {
    expect(accsmHostForServerName(D1)).toBe('https://accsm1.simracingalliance.com');
    expect(accsmHostForServerName(D3)).toBe('https://accsm2.simracingalliance.com');
    expect(accsmHostForServerName('#SRAggTT | TT | GT3_PubLobby  | SimRacingAlliance.com | SRAM6 | cBOP')).toBe(
      'https://accsm2.simracingalliance.com',
    );
    expect(accsmHostForServerName('x | SRAM7 | cBOP')).toBe('https://accsm1.simracingalliance.com');
  });

  it('returns null with no slot tag rather than guessing a host', () => {
    expect(accsmHostForServerName('#SRAggTT | TT | GT3_PracticeRace | cBOP')).toBeNull();
    expect(accsmHostForServerName(null)).toBeNull();
  });

  it('does not read a hashtag like #SRAM as a slot', () => {
    expect(accsmHostForServerName('#SRAM | Main Server')).toBeNull();
  });
});

describe('accsmResultPageUrl', () => {
  it('builds the singular /result/ page URL for a race', () => {
    expect(
      accsmResultPageUrl({
        sessionKey: '/server/0/results/download/261110_224450_R.json',
        sessionFile: '261110_224450_R',
        serverName: D1,
      }),
    ).toBe('https://accsm1.simracingalliance.com/server/0/result/2026-11-10_22-44-50_RACE');
  });

  it('maps qualifying and practice to ACCSM’s own type names', () => {
    expect(
      accsmResultPageUrl({
        sessionKey: '/server/0/results/download/261110_213509_Q.json',
        sessionFile: '261110_213509_Q',
        serverName: D1,
      }),
    ).toBe('https://accsm1.simracingalliance.com/server/0/result/2026-11-10_21-35-09_QUALIFYING');
    expect(
      accsmResultPageUrl({
        sessionKey: '/server/2/results/download/261116_133353_FP.json',
        sessionFile: '261116_133353_FP',
        serverName: '#SRAggTT | TT | GT3_FreePractice | R | SimRacingAlliance.com | SRAM5 | cBOP',
      }),
    ).toBe('https://accsm1.simracingalliance.com/server/2/result/2026-11-16_13-33-53_PRACTICE');
  });

  it('uses the server id from the session key, not a default', () => {
    expect(
      accsmResultPageUrl({
        sessionKey: '/server/2/results/download/261115_223747_R.json',
        sessionFile: '261115_223747_R',
        serverName: '#SRAggTT | TT | GT3_PubLobby  | SimRacingAlliance.com | SRAM6 | cBOP',
      }),
    ).toBe('https://accsm2.simracingalliance.com/server/2/result/2026-11-15_22-37-47_RACE');
  });

  it('returns null for anything it cannot place exactly', () => {
    // Admin-uploaded session: no Emperor download path to read a server id from.
    expect(
      accsmResultPageUrl({ sessionKey: 'upload:abc', sessionFile: '261110_224450_R', serverName: D1 }),
    ).toBeNull();
    // Unknown session suffix.
    expect(
      accsmResultPageUrl({
        sessionKey: '/server/0/results/download/261110_224450_R2.json',
        sessionFile: '261110_224450_R2',
        serverName: D1,
      }),
    ).toBeNull();
    // No slot tag → no host.
    expect(
      accsmResultPageUrl({
        sessionKey: '/server/0/results/download/261110_224450_R.json',
        sessionFile: '261110_224450_R',
        serverName: 'GT3_PracticeRace | Locked: D1 D2',
      }),
    ).toBeNull();
    expect(accsmResultPageUrl({ sessionKey: null, sessionFile: null, serverName: D1 })).toBeNull();
  });
});
