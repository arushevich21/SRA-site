import { describe, it, expect } from 'vitest';
import {
  accCarModelName,
  accCarModelIdByName,
  accCupCategoryName,
  accCarClassName,
  ACC_CAR_MODEL_NAMES,
  ACC_CUP_CATEGORY_NAMES,
} from './acc-constants.js';

describe('accCarModelName', () => {
  it.each([
    [0, 'Porsche 991 GT3 R'],
    [8, 'Bentley Continental GT3 2018'],
    [25, 'Mercedes-AMG GT3 2020'],
    [34, 'Porsche 992 GT3 R'],
    [61, 'Porsche 718 Cayman GT4'],
    [86, 'Porsche 935'],
  ])('resolves ID %i to %s', (id, name) => {
    expect(accCarModelName(id)).toBe(name);
  });

  it('returns null for an ID not in the handbook table', () => {
    // e.g. a car added by a game update newer than the handbook revision.
    // (36 used to be this case until Ford Mustang GT3 was confirmed and added.)
    expect(accCarModelName(37)).toBeNull();
    expect(accCarModelName(9999)).toBeNull();
  });
});

describe('accCarModelIdByName', () => {
  it('round-trips every table entry through accCarModelName', () => {
    for (const [id, name] of Object.entries(ACC_CAR_MODEL_NAMES)) {
      expect(accCarModelIdByName(name)).toBe(Number(id));
    }
  });

  it('normalizes case, diacritics, and punctuation the way Emperor is expected to vary them', () => {
    // Real table entry is "Lamborghini Huracan Evo2" (id 33) — no accent — but
    // Emperor (or any other reporter) echoing ACC's own display string is
    // just as likely to carry the accented "Huracán".
    expect(accCarModelIdByName('lamborghini huracán evo2')).toBe(33);
    expect(accCarModelIdByName('BMW-M4-GT3')).toBe(30); // hyphens instead of spaces
    expect(accCarModelIdByName('  Porsche 992 GT3 R  ')).toBe(34); // stray whitespace
  });

  it('returns null for null input and for a name not in the table', () => {
    expect(accCarModelIdByName(null)).toBeNull();
    expect(accCarModelIdByName('Some Car Nobody Has Heard Of')).toBeNull();
  });
});

describe('accCupCategoryName', () => {
  it.each([
    [0, 'Overall'],
    [1, 'ProAm'],
    [2, 'Am'],
    [3, 'Silver'],
    [4, 'National'],
  ])('resolves ID %i to %s', (id, name) => {
    expect(accCupCategoryName(id)).toBe(name);
  });

  it('returns null for an unknown ID', () => {
    expect(accCupCategoryName(99)).toBeNull();
  });
});

describe('accCarClassName', () => {
  it.each([
    [1, 'GT3'], // Mercedes-AMG GT3
    [9, 'GTC'], // Porsche 991II GT3 Cup
    [27, 'TCX'], // BMW M2 CS Racing — confirmed mislabeled "GT3" by an Oulton Park server
    [28, 'GTC'], // Porsche 911 GT3 Cup (Type 992) — same Oulton Park bug
    [18, 'GTC'], // Lamborghini Huracan SuperTrofeo
    [26, 'ST'], // Ferrari 488 Challenge Evo
    [56, 'GT4'], // Ginetta G55 GT4
    [82, 'GT2'], // KTM XBOW GT2
  ])('resolves ID %i to %s', (id, expected) => {
    expect(accCarClassName(id)).toBe(expected);
  });

  it('returns null for an ID not in the table', () => {
    expect(accCarClassName(9999)).toBeNull();
  });
});

describe('lookup table completeness', () => {
  it('matches the handbook\'s 53 documented car models plus confirmed post-handbook additions (Ford Mustang GT3)', () => {
    expect(Object.keys(ACC_CAR_MODEL_NAMES)).toHaveLength(54);
  });

  it('has exactly the 5 documented cup categories', () => {
    expect(Object.keys(ACC_CUP_CATEGORY_NAMES)).toHaveLength(5);
  });
});
