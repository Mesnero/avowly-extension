import { AuthError, CaptureError, toExtensionError } from '../lib/errors.js';
import { createLogger } from '../lib/logger.js';
import { enqueue, size } from '../lib/queue.js';
import { ExtensionMessage } from '../lib/schemas.js';
import { getSettings, setSettings } from '../lib/settings.js';
import { onSyncTick } from './sync.js';

const log = createLogger('background');

/**
 * Background service worker.
 *
 * Responsibilities at scaffold:
 *  - Receive `capture/prompt` messages from content scripts and persist them
 *    to the queue.
 *  - Reply to popup/options with current state.
 *  - Set up the periodic-sync alarm.
 *
 * Sync itself (drain queue → POST to API) lands when we have an API endpoint
 * to call. For now the queue just grows locally so the wiring is exercisable.
 */
export function startBackground(): void {
  log.info('worker starting');

  chrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
    handleMessage(rawMessage, sender)
      .then((reply) => {
        sendResponse(reply);
      })
      .catch((err: unknown) => {
        const e = toExtensionError(err);
        log.error('message handling failed', { code: e.code, message: e.message });
        sendResponse({ ok: false, error: { code: e.code, message: e.message } });
      });
    // Return true so Chrome keeps the message channel open for the async reply.
    return true;
  });

  // Periodic sync alarm. The handler is wired to drain the queue iteratively
  // to the API endpoint via POST /v1/prompts. `chrome.alarms.create`
  // returns a promise in MV3 service workers; we don't need to await — fire
  // and forget is fine for alarm registration.
  void chrome.alarms.create('sync', { periodInMinutes: 0.5 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'sync') {
      void onSyncTick();
    }
  });
}

/**
 * Exported as a test seam. Production code reaches it via the
 * `chrome.runtime.onMessage` listener registered in `startBackground()`.
 */
export async function handleMessage(
  raw: unknown,
  sender: chrome.runtime.MessageSender,
): Promise<{ ok: true; data?: unknown }> {
  // Trust-boundary check: only accept messages from our own content scripts,
  // popup, or options page. Without `externally_connectable` declared the
  // browser already refuses cross-extension `sendMessage` on Chromium, but
  // Firefox is more permissive and a public extension ID is easy to discover.
  //
  // Both Chromium and Firefox always populate `sender.id` with the
  // origin extension's id for any in-extension message (content
  // script, popup, options page). A `sender.id` that is `undefined`
  // or anything other than `chrome.runtime.id` is therefore not from
  // our extension and must be rejected. The previous form
  // (`!== undefined && !== runtime.id`) treated `undefined` as
  // trusted based on a misreading of MessageSender; close that gap.
  if (sender.id !== chrome.runtime.id) {
    throw new AuthError('Message rejected: untrusted sender', {
      meta: { senderId: sender.id ?? null },
    });
  }

  const parsed = ExtensionMessage.safeParse(raw);
  if (!parsed.success) {
    throw new CaptureError('Invalid message envelope', { meta: { issues: parsed.error.issues } });
  }
  const msg = parsed.data;

  switch (msg.kind) {
    case 'capture/prompt': {
      const settings = await getSettings();
      if (settings.paused) {
        log.debug('capture dropped: paused');
        return { ok: true, data: { dropped: 'paused' } };
      }
      if (settings.perPlatformEnabled[msg.prompt.platform] === false) {
        log.debug('capture dropped: platform disabled', { platform: msg.prompt.platform });
        return { ok: true, data: { dropped: 'platform-disabled' } };
      }
      await enqueue(msg.prompt);
      log.info('queued', {
        platform: msg.prompt.platform,
        length: msg.prompt.text.length,
        from: sender.tab?.url ? new URL(sender.tab.url).hostname : 'unknown',
      });
      return { ok: true };
    }
    case 'capture/error': {
      log.warn('adapter reported error', { platform: msg.platform, reason: msg.reason });
      return { ok: true };
    }
    case 'queue/status': {
      return { ok: true, data: { size: await size() } };
    }
    case 'settings/get': {
      return { ok: true, data: await getSettings() };
    }
    case 'settings/set': {
      await setSettings(msg.settings);
      return { ok: true };
    }
    default: {
      // Exhaustiveness check — fails type-check if a new variant is added
      // without a handler.
      const _exhaustive: never = msg;
      void _exhaustive;
      throw new CaptureError('Unhandled message kind');
    }
  }
}
