# What we capture

A plain-language description of exactly what the extension reads from the page, when, and where it goes. If the code doesn't match this document, the document is wrong (file an issue).

## What we capture

**Only the text of user prompts** submitted on supported LLM platforms.

- The prompt text, exactly as the user submitted it
- The platform identifier (e.g., `chatgpt`)
- A client-side timestamp (when the user pressed submit)
- A best-effort conversation/thread identifier (so the user can group related prompts in their dashboard)
- The extension version that captured it (so we can debug capture-quality regressions)

## What we explicitly do NOT capture

- Model responses (assistant messages)
- Other users' prompts in shared workspaces
- Prompts in incognito / private browsing windows (the extension is disabled there)
- Selected text, clicks, scroll position, or any other behavioral signal
- URLs the user visits outside of the supported LLM platforms
- Cookies, localStorage, sessionStorage, form data
- Prompts on platforms not in our supported list

## When we capture

The capture trigger is the **submit event** on the platform's input form (or the click of the send button). Specifically:

- We hook the form's `submit` event, not the Enter keypress. This handles voice input, Shift+Enter for newlines, and platforms that submit programmatically.
- We do not poll. We do not capture prompts that the user typed but did not submit.

## Where it goes

1. The captured prompt is normalized (whitespace trimmed, leading/trailing newlines removed).
2. It is queued in IndexedDB on the user's device with an idempotency key.
3. When online and authenticated, the background service worker uploads queued prompts to the Avowly API in batches.
4. The API performs PII redaction server-side; the redacted prompt is what's eligible for sale per the user's consent flags.
5. The user can see, reject, or delete every captured prompt via their dashboard, including during the 24-hour pre-sale review window.

## What controls the user has

- **Pause** the extension globally from the popup
- **Disable** the extension on a specific LLM platform from the options page
- **Reject** any prompt during the 24-hour pre-sale review window via the dashboard
- **Delete** any captured prompt at any time via the dashboard
- **Withdraw consent** entirely; subsequent capture stops within 5 minutes
- **Export everything** via the GDPR data export endpoint

## Reading the source

- DOM capture lives in `src/adapters/<platform>.ts`
- Capture queue lives in `src/lib/queue.ts`
- Sync lives in `src/background/sync.ts`

If anything in this document doesn't match the code, please open an issue.
