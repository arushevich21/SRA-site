import { describe, it, expect } from 'vitest';
import { parseServerPurpose } from './server-purpose';

describe('parseServerPurpose', () => {
  // Real advertised names, captured live from accsm1/accsm2 on 2026-09-28.
  it('reads format and conditions from a practice server', () => {
    expect(
      parseServerPurpose(
        '#SRAggTT | TT | GT3_FreePractice | R | SimRacingAlliance.com | SRAM1 | cBOP',
      ),
    ).toBe('GT3 Free Practice · Race conditions');
  });

  it('distinguishes quali conditions from race conditions', () => {
    expect(
      parseServerPurpose(
        '#SRAggTT | TT | GT3_FreePractice | Q | SimRacingAlliance.com | SRAM3 | cBOP',
      ),
    ).toBe('GT3 Free Practice · Quali conditions');
  });

  it('parenthesises a trailing Public/Private and copes with empty segments', () => {
    expect(
      parseServerPurpose(
        '#SRAggTT |  | #SRAE | GT3_QuickRace_Public | SimRacingAlliance.com | SRAM4 | cBOP',
      ),
    ).toBe('GT3 Quick Race (Public)');
  });

  it('returns null for a championship name with no format token', () => {
    expect(
      parseServerPurpose(
        '#SRAggTT | Division 1 | Season 18 | GT3 Team Championship | SimRacingAlliance.com | #SRAM1 | cBOP',
      ),
    ).toBeNull();
  });

  it('ignores the domain segment even though it has no underscore rules of its own', () => {
    // SimRacingAlliance.com must never be mistaken for a format token.
    expect(parseServerPurpose('SimRacingAlliance.com | GT4_FreePractice')).toBe(
      'GT4 Free Practice',
    );
  });

  it('does not mistake a stray R inside a word for the conditions token', () => {
    expect(parseServerPurpose('Rain | Rookie Server')).toBeNull();
  });

  it('handles conditions with no format token', () => {
    expect(parseServerPurpose('#SRAgg | Q | SRAM9')).toBe('Quali conditions');
  });

  it('is null-safe', () => {
    expect(parseServerPurpose(null)).toBeNull();
    expect(parseServerPurpose(undefined)).toBeNull();
    expect(parseServerPurpose('')).toBeNull();
  });
});
