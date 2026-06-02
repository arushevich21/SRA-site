import { describe, it, expect } from 'vitest';
import type { NormalizedEvent } from './index.js';

describe('shared-types placeholder', () => {
  it('NormalizedEvent interface is importable', () => {
    const event: NormalizedEvent = {};
    expect(event).toBeDefined();
  });
});
