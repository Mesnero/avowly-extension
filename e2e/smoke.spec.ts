import { expect, test } from '@playwright/test';

/**
 * Placeholder e2e. Per-platform synthetic tests land alongside each adapter:
 *
 *   e2e/chatgpt.spec.ts     Submits a known prompt to chatgpt.com, asserts
 *                           the extension queued exactly one capture.
 *   e2e/claude.spec.ts      Same for claude.ai.
 *   e2e/gemini.spec.ts      Same for gemini.google.com.
 *   e2e/perplexity.spec.ts  Same for perplexity.ai.
 *
 * They run nightly in CI as the adapter early-warning system.
 */
test('extension repo wiring smoke', () => {
  expect(true).toBe(true);
});
