import { describe, it, expect } from 'vitest';
import { currentChampionship } from './lib/current-championship.js';

describe('current-championship', () => {
  it('exports an object with name and game as non-empty strings', () => {
    expect(typeof currentChampionship.name).toBe('string');
    expect(typeof currentChampionship.game).toBe('string');
    expect(currentChampionship.name.length).toBeGreaterThan(0);
    expect(currentChampionship.game.length).toBeGreaterThan(0);
  });
});
