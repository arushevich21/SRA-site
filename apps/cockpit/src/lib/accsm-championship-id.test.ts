import { describe, it, expect } from 'vitest';
import { parseAccsmChampionshipId } from './accsm-championship-id';

const GUID = '66ec4e93-75b4-498c-bd66-8d66267af36c';

describe('parseAccsmChampionshipId', () => {
  it('accepts a bare guid', () => {
    expect(parseAccsmChampionshipId(GUID)).toBe(GUID);
  });

  it('accepts a full ACSM championship URL', () => {
    expect(
      parseAccsmChampionshipId(`https://accsm1.simracingalliance.com/championship/${GUID}`),
    ).toBe(GUID);
  });

  it('accepts a URL with a trailing slash, query or fragment', () => {
    for (const suffix of ['/', '?tab=standings', '#entrylist']) {
      expect(
        parseAccsmChampionshipId(`https://accsm3.simracingalliance.com/championship/${GUID}${suffix}`),
      ).toBe(GUID);
    }
  });

  it('trims surrounding whitespace', () => {
    expect(parseAccsmChampionshipId(`  ${GUID}\n`)).toBe(GUID);
  });

  it('lowercases so two spellings of one id never look like two championships', () => {
    expect(parseAccsmChampionshipId(GUID.toUpperCase())).toBe(GUID);
  });

  it('rejects a truncated guid rather than storing a value that matches nothing', () => {
    expect(parseAccsmChampionshipId('66ec4e93-75b4-498c-bd66')).toBeNull();
  });

  it('rejects a URL for some other ACSM entity', () => {
    expect(
      parseAccsmChampionshipId(`https://accsm1.simracingalliance.com/results/${GUID}`),
    ).toBeNull();
  });

  it('rejects empty and non-guid text', () => {
    expect(parseAccsmChampionshipId('')).toBeNull();
    expect(parseAccsmChampionshipId('   ')).toBeNull();
    expect(parseAccsmChampionshipId('division 1')).toBeNull();
  });
});
