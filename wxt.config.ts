import { defineConfig } from 'wxt';

import pkg from './package.json' with { type: 'json' };

/**
 * Build-time guards on the public env. These run in Node before Vite
 * bundles, unlike the runtime checks in `src/lib/env.ts` which only
 * fire when a browser evaluates the artifact. The runtime checks are
 * still kept (defence in depth — they catch a corrupted bundle that
 * somehow shipped) but the build-time pass is what actually fails CI
 * for a misconfigured release.
 */
function assertProductionPublicEnv(mode: string): void {
  if (mode !== 'production') return;
  const apiUrl = process.env.WXT_PUBLIC_API_BASE_URL ?? '';
  const clerkKey = process.env.WXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
  const debug = process.env.WXT_PUBLIC_DEBUG ?? '';
  const issues: string[] = [];
  if (!apiUrl.startsWith('https://')) {
    issues.push(
      'WXT_PUBLIC_API_BASE_URL must be set to an https:// URL for production builds (got: ' +
        (apiUrl === '' ? '<empty>' : apiUrl) +
        ')',
    );
  } else if (/^https:\/\/(localhost|127\.0\.0\.1)/i.test(apiUrl)) {
    issues.push('WXT_PUBLIC_API_BASE_URL must not point at localhost in production builds');
  }
  if (!clerkKey) {
    issues.push('WXT_PUBLIC_CLERK_PUBLISHABLE_KEY must be set in production builds');
  }
  if (debug === 'true' || debug === '1') {
    issues.push(
      'WXT_PUBLIC_DEBUG must not be enabled in production builds (would log URLs to console.debug on every page load)',
    );
  }
  if (issues.length > 0) {
    throw new Error('Refusing to build extension:\n  - ' + issues.join('\n  - '));
  }
}

/**
 * wxt config — single source of truth for the extension build.
 *
 * Targets:
 *  - Chrome / Chromium (default)         pnpm build
 *  - Firefox                             pnpm build:firefox
 *  - Safari (Phase 2)                    handled separately via Xcode wrapper
 *
 * Adapters live under `src/adapters/`. When we add the first platform adapter
 * (ChatGPT), we register a content script via `defineContentScript()` in the
 * adapter's own file and add the host permission below.
 */
export default defineConfig({
  hooks: {
    'build:before': (wxt) => {
      assertProductionPublicEnv(wxt.config.mode);
    },
  },
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: ({ browser }) => ({
    name: 'Avowly',
    short_name: 'Avowly',
    description:
      'Capture, control, and earn from your AI chat prompts. You decide what is shared, with whom, and what you get back.',
    // Sourced from package.json so a bumped release tag automatically becomes
    // the manifest version (Chrome Web Store and AMO both reject duplicate
    // versions). Keep `version` in package.json as the single source of truth.
    version: pkg.version,
    // Split incognito so the (disabled) extension instance in incognito cannot
    // capture data — we never run there.
    incognito: 'split',
    permissions: ['storage', 'alarms'],
    // Host permissions match the LLM platforms the adapters target plus
    // the API origin and Clerk's accounts domains. Production is HTTPS
    // only — `*://` would invite store reviewers to flag the schema as
    // over-broad. Add a host here only when an adapter or service-worker
    // call needs it, and document the rationale in PERMISSIONS.md.
    host_permissions: [
      'https://chatgpt.com/*',
      'https://chat.openai.com/*',
      'https://claude.ai/*',
      'https://gemini.google.com/*',
      'https://www.perplexity.ai/*',
      'https://api.avowly.io/*',
      'https://*.clerk.accounts.dev/*',
    ],
    action: {
      default_title: 'Avowly',
      default_popup: 'popup.html',
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
    // Firefox needs the gecko id for AMO; ignored on Chromium.
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'avowly@avowly.io',
              strict_min_version: '109.0',
            },
          },
        }
      : {}),
  }),
});
