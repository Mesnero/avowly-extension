import { describe, expect, it } from 'vitest';

import { findAdapter } from '../src/adapters/registry.js';

describe('findAdapter', () => {
  it('returns undefined for any URL while the registry is empty', () => {
    expect(findAdapter('https://chatgpt.com/c/abc')).toBeUndefined();
    expect(findAdapter('https://claude.ai/chat/xyz')).toBeUndefined();
    expect(findAdapter('https://example.com')).toBeUndefined();
  });
});
