import { describe, it, expect } from 'vitest';
import {
  accCarModelName,
  accCupCategoryName,
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
    expect(accCarModelName(36)).toBeNull();
    expect(accCarModelName(9999)).toBeNull();
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

describe('lookup table completeness', () => {
  it('matches the handbook\'s 53 documented car models (GT3, GT4, GT2 ranges)', () => {
    expect(Object.keys(ACC_CAR_MODEL_NAMES)).toHaveLength(53);
  });

  it('has exactly the 5 documented cup categories', () => {
    expect(Object.keys(ACC_CUP_CATEGORY_NAMES)).toHaveLength(5);
  });
});
