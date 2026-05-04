import type { PlatformAdapter } from './base.js';
import { chatgptAdapter } from './chatgpt.js';

/**
 * Central registry of adapters. Adding a platform = importing it here and
 * pushing onto the array. The content-script bootstrap iterates this list to
 * decide which adapter (if any) to run for the current page.
 *
 * MVP launches with: chatgpt, claude, gemini, perplexity. Each is added in
 * its own commit with fixtures + manifest host_permissions.
 */
export const adapters: readonly PlatformAdapter[] = [chatgptAdapter];

// Validate every registered match pattern once, at module load. A bad
// pattern (e.g., `https://*.com/*`) would silently match any HTTPS
// site and route arbitrary page DOM into our adapters, so we want
// failure to be a test crash on import — not a per-URL throw on a
// user's machine. `urlMatches` below relies on this having run.
for (const adapter of adapters) {
  for (const pattern of adapter.matches) {
    assertValidMatchPattern(pattern);
  }
}

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
 * Validate a single match pattern. Patterns are developer-supplied
 * (the `adapters` array above), but a typo like `https://*.com/*` would
 * silently match any HTTPS site and route arbitrary page DOM into our
 * adapters. Called once per pattern at module load — see the loop
 * directly under the `adapters` declaration.
 *
 * Allowed shapes today (kept narrow on purpose; widen deliberately):
 *   https://exact.host/*
 *   https://exact.host/path
 *   https://exact.host/path/*
 *
 * Disallowed: wildcards in the host (`*.example.com`), bare-host
 * wildcards (`*://...`), schemes other than https, and any pattern
 * not anchored to a literal hostname.
 */
export function assertValidMatchPattern(pattern: string): void {
  if (!pattern.startsWith('https://')) {
    throw new Error(
      `Invalid adapter match pattern (must start with https://): ${JSON.stringify(pattern)}`,
    );
  }
  const afterScheme = pattern.slice('https://'.length);
  const slashIndex = afterScheme.indexOf('/');
  if (slashIndex === -1) {
    throw new Error(
      `Invalid adapter match pattern (missing path): ${JSON.stringify(pattern)} — write https://host/* if you want to match any path`,
    );
  }
  const host = afterScheme.slice(0, slashIndex);
  if (host.length === 0) {
    throw new Error(`Invalid adapter match pattern (empty host): ${JSON.stringify(pattern)}`);
  }
  if (host.includes('*')) {
    throw new Error(
      `Invalid adapter match pattern (wildcards in host are not allowed): ${JSON.stringify(pattern)}`,
    );
  }
  // Host must look like a real domain — letters/digits/dots/hyphens.
  // Refuses port-in-host shenanigans, IDN punycode is fine because it's
  // ASCII by the time it reaches a match pattern.
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(host)) {
    throw new Error(`Invalid adapter match pattern (bad host shape): ${JSON.stringify(pattern)}`);
  }
}

/**
 * Match a URL against a Chrome-extension-style match pattern (very simplified
 * — full grammar in https://developer.chrome.com/docs/extensions/mv3/match_patterns/).
 * Adequate for the host patterns we use; we don't accept user-supplied patterns.
 * Patterns are pre-validated at module load by the loop above, so this
 * stays a tight hot path.
 */
function urlMatches(url: string, pattern: string): boolean {
  // Convert "https://chatgpt.com/*" → /^https:\/\/chatgpt\.com\/.*$/.
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(url);
}
