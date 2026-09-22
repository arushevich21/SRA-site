import { describe, expect, it } from 'vitest';
import { groupForServer, practiceRaceHref } from './practice-race';

describe('groupForServer', () => {
  it('reads the SRAM slot tag off a live server name', () => {
    expect(
      groupForServer('#SRAggTT | TT | GT3_PracticeRace | Locked: D1 D2  | SimRacingAlliance.com | SRAM1 | cBOP')
        ?.key,
    ).toBe('d1-d2');
    expect(
      groupForServer('#SRAggTT | TT | GT3_PracticeRace | UnLocked: D3 D4  | SimRacingAlliance.com | SRAM2 | cBOP')
        ?.key,
    ).toBe('d3-d4');
  });

  it('falls back to the division label when the slot tag is missing', () => {
    expect(groupForServer('GT3_PracticeRace | Locked: D3 D4 | cBOP')?.key).toBe('d3-d4');
  });

  it('does not match a name for neither grid', () => {
    expect(groupForServer('#SRAggTT | TT | GT3_FreePractice | Q | SRAM3 | cBOP')).toBeNull();
    expect(groupForServer(null)).toBeNull();
  });
});

describe('practiceRaceHref', () => {
  const base = { id: 'abc', game: 'ACC', href: null };
  it('links an ACC practice-race entry without its own href', () => {
    expect(practiceRaceHref({ ...base, title: 'R1 Practice Race' })).toBe('/acc/practice-race/abc');
  });
  it('leaves other entries alone', () => {
    expect(practiceRaceHref({ ...base, title: 'Livery Reveal Stream' })).toBeNull();
    expect(practiceRaceHref({ ...base, title: 'R1 Practice Race', game: 'LMU' })).toBeNull();
    expect(practiceRaceHref({ ...base, title: 'R1 Practice Race', href: '/x' })).toBeNull();
  });
});
