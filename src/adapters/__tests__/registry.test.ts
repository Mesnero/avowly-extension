import { describe, expect, it } from 'vitest';

import { adapters, findAdapter } from '../registry.js';

describe('adapter registry', () => {
  it('starts empty at scaffold time', () => {
    // This will fail (intentionally) the first time we add a real adapter.
    // That failure is the cue to update this test alongside the new adapter.
    expect(adapters).toEqual([]);
  });

  it('returns undefined when no adapter matches', () => {
    expect(findAdapter('https://example.com/')).toBeUndefined();
  });
});
