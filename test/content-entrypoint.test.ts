import { describe, expect, it } from 'vitest';

import { adapters } from '../src/adapters/registry.js';
import contentScript, { contentScriptMatches } from '../src/entrypoints/content.js';

describe('content script entrypoint', () => {
  it('registers every adapter match pattern with WXT', () => {
    const adapterMatches = adapters.flatMap((adapter) => adapter.matches);

    expect(contentScriptMatches).toEqual(adapterMatches);
    expect(contentScriptMatches).toContain('https://chatgpt.com/*');
    expect(contentScriptMatches).toContain('https://chat.openai.com/*');
    expect(contentScriptMatches.length).toBeGreaterThan(0);
  });

  it('uses the same non-empty matches in the exported WXT definition', () => {
    expect(contentScript.matches).toEqual(contentScriptMatches);
  });
});
