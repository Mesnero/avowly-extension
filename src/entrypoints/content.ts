import { defineContentScript } from 'wxt/sandbox';

import { adapters } from '../adapters/registry.js';
import { bootstrap } from '../content/bootstrap.js';

/**
 * Generic content script. The adapter registry owns the supported URL list;
 * WXT needs that same list here so the generated manifest actually injects
 * this script on those pages.
 */
export const contentScriptMatches = Array.from(new Set(adapters.flatMap((a) => a.matches)));

export default defineContentScript({
  matches: contentScriptMatches,
  runAt: 'document_idle',
  main() {
    bootstrap();
  },
});
