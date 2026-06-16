import { describe, it, expect } from 'vitest';
import { GridOSClient } from './index.js';

describe('simgrid-client', () => {
  it('GridOSClient is a constructor', () => {
    expect(GridOSClient).toBeTypeOf('function');
    const client = new GridOSClient('https://example.com/api/v1', 'test-key');
    expect(client).toBeInstanceOf(GridOSClient);
  });
});
