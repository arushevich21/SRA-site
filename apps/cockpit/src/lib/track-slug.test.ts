import { describe, it, expect } from 'vitest';
import { trackSlug, buildTrackKey } from './track-slug';

describe('trackSlug', () => {
  it('lowercases and hyphenates', () => {
    expect(trackSlug('Circuit Of The Americas')).toBe('circuit-of-the-americas');
  });

  it('strips leading/trailing punctuation', () => {
    expect(trackSlug('  Road Atlanta! ')).toBe('road-atlanta');
  });
});

describe('buildTrackKey', () => {
  it('is just the track slug when no layout is given', () => {
    expect(buildTrackKey('Laguna Seca')).toBe('laguna-seca');
    expect(buildTrackKey('Laguna Seca', null)).toBe('laguna-seca');
  });

  it('appends the layout slug when present', () => {
    expect(buildTrackKey('Road Atlanta', 'GP')).toBe('road-atlanta__gp');
    expect(buildTrackKey('Circuit Of The Americas', 'National')).toBe(
      'circuit-of-the-americas__national',
    );
  });

  it('different layouts of the same track never collide', () => {
    expect(buildTrackKey('Silverstone', 'GP')).not.toBe(buildTrackKey('Silverstone', 'National'));
  });
});
