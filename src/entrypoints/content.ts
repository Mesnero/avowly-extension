import { defineContentScript } from 'wxt/sandbox';

import { bootstrap } from '../content/bootstrap.js';

/**
 * Generic content script. Once we add real platform adapters, each adapter's
 * file declares its own `defineContentScript` with the right URL matches and
 * imports `bootstrap()` to route the page to the registered adapter.
 *
 * For now this scaffolding entry exists so the dev build runs without errors;
 * the matches list is empty so it never actually injects anywhere.
 */
export default defineContentScript({
  matches: [], // populated per-platform in adapter files
  runAt: 'document_idle',
  main() {
    bootstrap();
  },
});
