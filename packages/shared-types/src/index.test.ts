import { describe, it, expect } from 'vitest';
import { GridOSError } from './index.js';

describe('shared-types', () => {
  it('GridOSError is constructable and carries status + endpoint', () => {
    const err = new GridOSError(404, '/championships/9622', 'not found');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('GridOSError');
    expect(err.status).toBe(404);
    expect(err.endpoint).toBe('/championships/9622');
    expect(err.message).toBe('not found');
  });
});
