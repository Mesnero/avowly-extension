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
  return {
    emit: (prompt) => {
      const enriched: CapturedPrompt = {
        ...prompt,
        extensionVersion: chrome.runtime.getManifest().version,
      };
      sendToBackground({ kind: 'capture/prompt', prompt: enriched }).catch((err: unknown) => {
        log.error('emit failed', { err: err instanceof Error ? err.message : String(err) });
      });
    },
    reportError: (reason) => {
      sendToBackground({ kind: 'capture/error', platform: adapter.id, reason }).catch(() => {
        /* swallow — already logged elsewhere */
      });
    },
    log,
    signal,
  };
}

async function sendToBackground(message: ExtensionMessage): Promise<unknown> {
  return chrome.runtime.sendMessage(message);
}
