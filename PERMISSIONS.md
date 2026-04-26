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

Each host is added when the corresponding platform adapter ships. At MVP:

- *(empty until the first adapter lands)*

When ChatGPT adapter ships, this list will include:
- `https://chatgpt.com/*`
- `https://chat.openai.com/*`

Each new entry will be added in the same PR as the adapter that requires it, with a one-line explanation here.

## What we do NOT request

- `tabs` — we never enumerate the user's open tabs
- `webRequest` / `webRequestBlocking` — we do not intercept network traffic
- `cookies` — we do not read site cookies
- `<all_urls>` — we only run on domains we explicitly support
- `clipboardRead` / `clipboardWrite` — never
- `nativeMessaging` — never

## Incognito

The manifest declares `"incognito": "split"` (not `"spanning"`), which means an incognito window gets a separate, disabled extension instance. Combined with a runtime check (`chrome.extension.inIncognitoContext`) in the content scripts, no capture can happen in private browsing.
