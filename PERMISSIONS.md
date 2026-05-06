# Permissions

Every permission this extension requests, why it's needed, and what data it gives us access to. Updated in the same PR that adds or removes a permission.

## API permissions (declared in manifest.permissions)

### `storage`
**Why:** Persist user preferences (paused/active per platform, compensation mode), cache the last-sync timestamp, and store the persistent capture queue (in IndexedDB via Dexie, but the manifest permission gates `chrome.storage.*` access we use for small key-value state).

**Data:** Local-only. Never transmitted unless the user is signed in and the prompt is being synced to the API.

### `alarms`
**Why:** Periodic background sync of the capture queue (every 30s when online; less aggressively when idle).

**Data:** None. Just timer scheduling.

## Host permissions (declared in manifest.host_permissions)

Each host gates a specific outbound capability. New entries land in the same PR as the feature that needs them with a one-line rationale here.

### LLM platforms

- `https://chatgpt.com/*` and `https://chat.openai.com/*` — ChatGPT adapter content script reads the prompt textarea on submit. Both hosts because OpenAI redirects between them.
- `https://claude.ai/*` — Claude adapter (placeholder; capture wires up when the adapter ships).
- `https://gemini.google.com/*` — Gemini adapter (placeholder).
- `https://www.perplexity.ai/*` — Perplexity adapter (placeholder).

### Backend services

- `https://api.avowly.io/*` — service worker `POST /v1/prompts` to sync the queue.
- `https://*.clerk.accounts.dev/*` — Clerk session sync from the dashboard origin into the extension popup, plus background token refresh via `@clerk/chrome-extension`. Replace with the production Clerk domain once `clerk.avowly.io` is configured.

## What we do NOT request

- `tabs` — we never enumerate the user's open tabs
- `webRequest` / `webRequestBlocking` — we do not intercept network traffic
- `cookies` — we do not read site cookies
- `<all_urls>` — we only run on domains we explicitly support
- `clipboardRead` / `clipboardWrite` — never
- `nativeMessaging` — never

## Incognito

The manifest declares `"incognito": "split"` (not `"spanning"`), which means an incognito window gets a separate, disabled extension instance. Combined with a runtime check (`chrome.extension.inIncognitoContext`) in the content scripts, no capture can happen in private browsing.
