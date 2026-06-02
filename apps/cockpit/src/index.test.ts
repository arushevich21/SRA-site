import { describe, it, expect } from 'vitest';
import { VERSION } from './index.js';

describe('cockpit placeholder', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.0.0');
  });
});
