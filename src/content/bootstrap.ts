import type { AdapterContext, AdapterHandle, PlatformAdapter } from '../adapters/base.js';
import { findAdapter } from '../adapters/registry.js';
import { createLogger } from '../lib/logger.js';
import type { CapturedPrompt, ExtensionMessage } from '../lib/schemas.js';

const log = createLogger('content-bootstrap');

/**
 * Content-script entry point. Decides whether the current page has a
 * supported adapter, sets up the adapter context, and forwards captures to
 * the background worker.
 *
 * Capture in incognito is forbidden (manifest declares incognito: split AND we
 * gate at runtime here, belt-and-braces).
 */
export function bootstrap(): AdapterHandle | undefined {
  // Belt-and-braces: even if a future manifest change accidentally enables
  // incognito, this gate refuses to capture.
  if (chrome.extension.inIncognitoContext) {
    log.info('incognito context — capture disabled');
    return undefined;
  }

  const adapter = findAdapter(window.location.href);
  if (!adapter) {
    log.debug('no adapter for url', { href: window.location.href });
    return undefined;
  }

  const controller = new AbortController();
  const ctx: AdapterContext = buildContext(adapter, controller.signal);

  log.info('adapter init', { platform: adapter.id });
  const handle = adapter.init(ctx);

  window.addEventListener(
    'pagehide',
    () => {
      controller.abort();
      handle.dispose();
    },
    { once: true },
  );

  return handle;
}

function buildContext(adapter: PlatformAdapter, signal: AbortSignal): AdapterContext {
  const log = createLogger(`adapter:${adapter.id}`);

  // `reportError` posts a `capture/error` to the background worker so the
  // popup's error view can surface failures to the user. Defined first so
  // `emit` can call it on send failure.
  const reportError = (reason: string): void => {
    sendToBackground({ kind: 'capture/error', platform: adapter.id, reason }).catch(() => {
      /* If even the error report can't reach the background, we have no
         channel left to the user. Logged in the catch above already. */
    });
  };

  return {
    emit: (prompt) => {
      const enriched: CapturedPrompt = {
        ...prompt,
        extensionVersion: chrome.runtime.getManifest().version,
      };
      sendToBackground({ kind: 'capture/prompt', prompt: enriched }).catch((err: unknown) => {
        // Log the raw error message *only* to the adapter-scoped
        // logger (DevTools-only). Do NOT propagate `err.message` to
        // `reportError` — that string ends up in `capture/error.reason`
        // which traverses the trust boundary into the background log.
        // While today's Chromium runtime doesn't echo payload bytes
        // back in send-error messages, that is an implementation
        // detail we shouldn't depend on; one browser change away,
        // a `String(err)` here could pull in serialized prompt text.
        // A static label is sufficient for the popup to flag a
        // failure to the user.
        const message = err instanceof Error ? err.message : String(err);
        log.error('emit failed', { err: message });
        reportError('send failed');
      });
    },
    reportError,
    log,
    signal,
  };
}

async function sendToBackground(message: ExtensionMessage): Promise<unknown> {
  return chrome.runtime.sendMessage(message);
}
