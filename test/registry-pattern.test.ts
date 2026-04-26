import { describe, expect, it } from 'vitest';

import { assertValidMatchPattern, findAdapter } from '../src/adapters/registry.js';

describe('findAdapter', () => {
  it('returns undefined for any URL while the registry is empty', () => {
    expect(findAdapter('https://chatgpt.com/c/abc')).toBeUndefined();
    expect(findAdapter('https://claude.ai/chat/xyz')).toBeUndefined();
    expect(findAdapter('https://example.com')).toBeUndefined();
  });
});

describe('assertValidMatchPattern', () => {
  it.each([
    'https://chatgpt.com/*',
    'https://claude.ai/*',
    'https://gemini.google.com/app/*',
    'https://www.perplexity.ai/',
  ])('accepts well-formed pattern %s', (pattern) => {
    expect(() => {
      assertValidMatchPattern(pattern);
    }).not.toThrow();
  });

  it.each([
    // Wildcard host — would match arbitrary HTTPS sites.
    'https://*.com/*',
    'https://*/*',
    // Plain `*://` scheme wildcard — we only ever want HTTPS.
    '*://chatgpt.com/*',
    // Plain HTTP — extension MUST NOT inject into plaintext pages.
    'http://chatgpt.com/*',
    // Missing path entirely.
    'https://chatgpt.com',
    // Empty host.
    'https:///*',
    // Garbage host shape.
    'https://-bad-/*',
  ])('rejects malformed pattern %s', (pattern) => {
    expect(() => {
      assertValidMatchPattern(pattern);
    }).toThrow(/Invalid adapter match pattern/);
  });
});
