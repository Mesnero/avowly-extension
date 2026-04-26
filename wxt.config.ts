import { defineConfig } from 'wxt';

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
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: ({ browser }) => ({
    name: 'Avowly',
    short_name: 'Avowly',
    description:
      'Capture, control, and earn from your AI chat prompts. You decide what is shared, with whom, and what you get back.',
    version: '0.0.0',
    // Split incognito so the (disabled) extension instance in incognito cannot
    // capture data — we never run there.
    incognito: 'split',
    permissions: ['storage', 'alarms'],
    // Host permissions are added per platform-adapter as we build them.
    // The API host is added once we have a domain.
    host_permissions: [],
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
