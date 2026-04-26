import type { PlatformAdapter } from './base.js';

/**
 * Central registry of adapters. Adding a platform = importing it here and
 * pushing onto the array. The content-script bootstrap iterates this list to
 * decide which adapter (if any) to run for the current page.
 *
 * MVP launches with: chatgpt, claude, gemini, perplexity. Each is added in
 * its own commit with fixtures + manifest host_permissions.
 */
export const adapters: readonly PlatformAdapter[] = [];

/**
 * Find the adapter (if any) whose URL match list covers the given URL.
 * Returns undefined if no adapter matches — content scripts use this to
 * silently bail on pages that aren't in scope.
 */
export function findAdapter(url: string): PlatformAdapter | undefined {
  for (const adapter of adapters) {
    if (adapter.matches.some((pattern) => urlMatches(url, pattern))) {
      return adapter;
    }
  }
  return undefined;
}

/**
 * Match a URL against a Chrome-extension-style match pattern (very simplified
 * — full grammar in https://developer.chrome.com/docs/extensions/mv3/match_patterns/).
 * Adequate for the host patterns we use; we don't accept user-supplied patterns.
 */
function urlMatches(url: string, pattern: string): boolean {
  // Convert "https://chatgpt.com/*" → /^https:\/\/chatgpt\.com\/.*$/.
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(url);
}
