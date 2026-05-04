import { describe, expect, it } from 'vitest';

import { adapters, findAdapter } from '../registry.js';
import { chatgptAdapter } from '../chatgpt.js';

describe('adapter registry', () => {
  it('contains the expected list of adapters for launch', () => {
    expect(adapters).toEqual([chatgptAdapter]);
  });

  it('returns undefined when no adapter matches', () => {
    expect(findAdapter('https://example.com/')).toBeUndefined();
  });
});
