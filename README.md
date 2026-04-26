# avowly-extension

Browser extension for [Avowly](https://avowly.io) — captures user prompts on supported LLM platforms with full transparency and consent.

> Companion repository: [`avowly-platform`](../avowly-platform) — the API, dashboards, and infra.
> Architectural context lives in [`../ai-guides`](../ai-guides). Always read `00-vision.md` and `01-principles.md` first.

## What we capture

**Only user prompts** on a small set of supported LLM platforms (ChatGPT, Claude, Gemini, Perplexity at launch). We never capture model responses. We never run in incognito. See [`PERMISSIONS.md`](./PERMISSIONS.md) and [`CAPTURE.md`](./CAPTURE.md) for the full story.

## Stack

- [wxt](https://wxt.dev) — cross-browser MV3 build tool
- React 19 + TypeScript (strict)
- Tailwind CSS for the popup and options UI
- Dexie for the persistent capture queue
- Zod for runtime validation of every message and stored payload
- Vitest for unit tests; Playwright for e2e against real LLM platforms

## Prerequisites

- [`mise`](https://mise.jdx.dev) (recommended) or Node 22 + pnpm 9

## Getting started

```bash
mise install
pnpm install
cp .env.example .env

# Run in dev with hot reload (Chromium)
pnpm dev

# Or for Firefox
pnpm dev:firefox
```

`pnpm dev` opens a fresh Chromium window with the extension loaded. Edits in `src/` hot-reload.

## Build

```bash
pnpm build              # Chromium MV3 zip in .output/chrome-mv3
pnpm build:firefox      # Firefox MV3 zip in .output/firefox-mv3
pnpm zip                # Bundles both into shippable .zip files
```

## Layout

```
src/
├── adapters/            One file per LLM platform (drop-in extensible)
│   └── __tests__/       Fixture-based DOM tests per adapter
├── background/          Service worker (queue, sync, auth glue)
├── content/             Content-script bootstrap that loads adapters
├── entrypoints/
│   ├── popup/           Popup UI (React)
│   ├── options/         Options page (React)
│   └── background.ts    wxt-defined background entry
└── lib/                 Storage, API client, errors, logger
```

## Adding a new LLM platform

1. Create `src/adapters/<platform>.ts` exporting a `PlatformAdapter` (see `src/adapters/base.ts`)
2. Register it in `src/adapters/registry.ts`
3. Add the host in `wxt.config.ts → manifest.host_permissions`
4. Add fixture tests in `src/adapters/__tests__/<platform>.test.ts`
5. Document the new permission in `PERMISSIONS.md`

That's it. No core changes.

## Testing

- **Unit / DOM-fixture**: `pnpm test`. Adapters are tested against captured HTML fixtures so we notice when a platform changes its DOM.
- **E2E**: `pnpm test:e2e` runs Playwright against real LLM platforms. Run nightly in CI as the early-warning system.

## License

[AGPL-3.0-only](./LICENSE). The trust narrative requires the extension to be auditable; AGPL ensures any forked deployment stays open.

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for how to contribute.
