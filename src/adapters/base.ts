import type { Logger } from '../lib/logger.js';
import type { CapturedPrompt, PlatformId } from '../lib/schemas.js';

/**
 * Contract every LLM-platform adapter implements.
 *
 * The point of this abstraction is that adding a new platform is "drop one
 * file, register it, write fixtures." Anything that would cost more than that
 * means we have a leak — fix the leak, don't bypass the abstraction.
 *
 * Adapters do exactly three things:
 *  1. Watch the page for the input area (resilient to SPA route changes).
 *  2. Hook the submit event (NOT the Enter keypress — voice input, Shift+Enter,
 *     and programmatic submission must all work).
 *  3. Emit a `CapturedPrompt` via `ctx.emit()`.
 *
 * Adapters MUST NOT:
 *  - Read assistant responses
 *  - Send anything to the API directly (the background worker does that)
 *  - Persist anything (the queue is the background's job)
 *  - Run in incognito (handled by the manifest + a runtime check in the bootstrap)
 *  - Read prompt text from DOM attributes the host page can manipulate
 *    (data-*, title, aria-label, dataset, hidden inputs the page has set).
 *    Always read from the actual user-input element's `.value` /
 *    `.textContent` AT submit-time. The adapter is the trust boundary
 *    between an untrusted page DOM and our typed `CapturedPrompt`.
 *  - Capture text outside the user's input area (e.g., system-prompt
 *    panels, prefill text the page injected, suggested-prompt buttons).
 */
export interface PlatformAdapter {
  /** Stable id sent to the API and used in metrics. */
  readonly id: PlatformId;

  /**
   * URL match patterns where this adapter should be loaded. Used by the
   * content-script bootstrap to decide which adapter (if any) to init.
   */
  readonly matches: readonly string[];

  /**
   * Initialize the adapter on the page. Called once per page load when a
   * matching URL is detected. Must be idempotent on repeated calls.
   *
   * Returns a handle whose `dispose()` is called when the page unloads or the
   * extension is paused. Adapter must clean up observers/listeners on dispose.
   */
  init(ctx: AdapterContext): AdapterHandle;
}

export interface AdapterContext {
  /** Adapter calls this when a prompt is captured. */
  emit: (prompt: Omit<CapturedPrompt, 'extensionVersion'>) => void;
  /** Adapter calls this when capture failed unrecoverably (DOM changed, etc.). */
  reportError: (reason: string) => void;
  /** Logger scoped to the adapter id. */
  log: Logger;
  /** Aborted when the content script unloads or the user pauses the extension. */
  signal: AbortSignal;
}

export interface AdapterHandle {
  dispose: () => void;
}
