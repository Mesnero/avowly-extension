import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleMessage } from '../src/background/index.js';
import { AuthError, CaptureError } from '../src/lib/errors.js';
import { uuidv7 } from '../src/lib/ids.js';
import { db } from '../src/lib/queue.js';
import { defaultSettings, setSettings } from '../src/lib/settings.js';

vi.mock('../src/lib/env.js', () => ({
  env: { API_BASE_URL: 'https://api.example.test', DEBUG: false },
}));

/**
 * The browser always populates `sender.id` with the origin
 * extension's id for any in-extension message (content script, popup,
 * options page). Tests must mirror that — a sender with no `id` is
 * rejected by handleMessage and would no-op the rest of the assertion.
 *
 * Built lazily because the global `chrome` mock is set up in
 * setup.ts's `beforeEach`, not at module load time.
 */
function makeSender(): chrome.runtime.MessageSender {
  return {
    id: chrome.runtime.id,
    tab: { id: 1, url: 'https://chat.openai.com/c/abc' } as chrome.tabs.Tab,
  };
}

beforeEach(async () => {
  await db.prompts.clear();
  await setSettings(defaultSettings);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function validPromptMessage(text = 'hello'): unknown {
  return {
    kind: 'capture/prompt',
    prompt: {
      id: uuidv7(),
      platform: 'chatgpt' as const,
      text,
      capturedAt: Date.now(),
      extensionVersion: '0.0.0-test',
    },
  };
}

describe('handleMessage — envelope validation', () => {
  it('throws CaptureError on a malformed envelope', async () => {
    await expect(handleMessage({ kind: 'unknown' }, makeSender())).rejects.toBeInstanceOf(
      CaptureError,
    );
  });

  it('throws CaptureError on a missing kind', async () => {
    await expect(handleMessage({}, makeSender())).rejects.toBeInstanceOf(CaptureError);
  });
});

describe('handleMessage — sender trust boundary', () => {
  it('rejects messages from another extension or a connected web page', async () => {
    const foreignSender = {
      id: 'malicious-extension-id',
      tab: { id: 1, url: 'https://attacker.example' } as chrome.tabs.Tab,
    };
    await expect(handleMessage(validPromptMessage(), foreignSender)).rejects.toBeInstanceOf(
      AuthError,
    );
    expect(await db.prompts.count()).toBe(0);
  });

  it('accepts messages whose sender.id matches the extension', async () => {
    const ownSender = {
      id: chrome.runtime.id,
      tab: { id: 1, url: 'https://chat.openai.com/c/abc' } as chrome.tabs.Tab,
    };
    const reply = await handleMessage(validPromptMessage(), ownSender);
    expect(reply).toEqual({ ok: true });
  });

  it('rejects messages with no sender.id', async () => {
    // In Chromium and Firefox, in-extension messages (content script,
    // popup, options) always carry the origin extension's id. A
    // missing id therefore is NOT from our extension and is treated
    // as untrusted — this guards against any future code path that
    // somehow delivers a stripped sender.
    await expect(handleMessage(validPromptMessage(), {})).rejects.toBeInstanceOf(AuthError);
    expect(await db.prompts.count()).toBe(0);
  });
});

describe('handleMessage — capture/prompt', () => {
  it('queues the prompt when settings allow it', async () => {
    const msg = validPromptMessage();
    const reply = await handleMessage(msg, makeSender());
    expect(reply).toEqual({ ok: true });
    expect(await db.prompts.count()).toBe(1);
  });

  it('drops the capture when globally paused', async () => {
    await setSettings({ ...defaultSettings, paused: true });
    const reply = await handleMessage(validPromptMessage(), makeSender());
    expect(reply).toEqual({ ok: true, data: { dropped: 'paused' } });
    expect(await db.prompts.count()).toBe(0);
  });

  it('drops the capture when the platform is disabled', async () => {
    await setSettings({
      ...defaultSettings,
      perPlatformEnabled: { ...defaultSettings.perPlatformEnabled, chatgpt: false },
    });
    const reply = await handleMessage(validPromptMessage(), makeSender());
    expect(reply).toEqual({ ok: true, data: { dropped: 'platform-disabled' } });
    expect(await db.prompts.count()).toBe(0);
  });

  it('tolerates a sender without a tab url', async () => {
    // popup/options have no `sender.tab`. The id is still populated
    // by the browser and is what the trust-boundary check relies on.
    const noTabSender = { id: chrome.runtime.id };
    const reply = await handleMessage(validPromptMessage(), noTabSender);
    expect(reply).toEqual({ ok: true });
    expect(await db.prompts.count()).toBe(1);
  });
});

describe('handleMessage — capture/error', () => {
  it('acknowledges the report without queueing anything', async () => {
    const reply = await handleMessage(
      { kind: 'capture/error', platform: 'claude', reason: 'selector missing' },
      makeSender(),
    );
    expect(reply).toEqual({ ok: true });
    expect(await db.prompts.count()).toBe(0);
  });

  it('rejects an oversized reason (> 512 chars) at the schema boundary', async () => {
    const reply = handleMessage(
      { kind: 'capture/error', platform: 'claude', reason: 'a'.repeat(513) },
      makeSender(),
    );
    await expect(reply).rejects.toBeInstanceOf(CaptureError);
  });
});

describe('handleMessage — queue/status', () => {
  it('returns the current queue size', async () => {
    await handleMessage(validPromptMessage('a'), makeSender());
    await handleMessage(validPromptMessage('b'), makeSender());
    const reply = await handleMessage({ kind: 'queue/status' }, makeSender());
    expect(reply).toEqual({ ok: true, data: { size: 2 } });
  });
});

describe('handleMessage — settings/get and settings/set', () => {
  it('returns current settings via settings/get', async () => {
    const reply = await handleMessage({ kind: 'settings/get' }, makeSender());
    expect(reply).toEqual({ ok: true, data: defaultSettings });
  });

  it('persists new settings via settings/set', async () => {
    const next = { ...defaultSettings, paused: true };
    const reply = await handleMessage({ kind: 'settings/set', settings: next }, makeSender());
    expect(reply).toEqual({ ok: true });

    const after = await handleMessage({ kind: 'settings/get' }, makeSender());
    expect(after).toEqual({ ok: true, data: next });
  });
});
