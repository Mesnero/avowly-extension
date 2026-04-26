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

const sender: chrome.runtime.MessageSender = {
  // tab is enough for the URL-extracting branch in handleMessage's logger.
  tab: { id: 1, url: 'https://chat.openai.com/c/abc' } as chrome.tabs.Tab,
};

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
    await expect(handleMessage({ kind: 'unknown' }, sender)).rejects.toBeInstanceOf(CaptureError);
  });

  it('throws CaptureError on a missing kind', async () => {
    await expect(handleMessage({}, sender)).rejects.toBeInstanceOf(CaptureError);
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

  it('accepts messages with no sender.id (in-extension contexts: popup, options, content scripts)', async () => {
    // In real Chrome, content scripts and extension pages may produce a
    // sender object without a top-level `id` set. Treat undefined as trusted.
    const reply = await handleMessage(validPromptMessage(), {});
    expect(reply).toEqual({ ok: true });
  });
});

describe('handleMessage — capture/prompt', () => {
  it('queues the prompt when settings allow it', async () => {
    const msg = validPromptMessage();
    const reply = await handleMessage(msg, sender);
    expect(reply).toEqual({ ok: true });
    expect(await db.prompts.count()).toBe(1);
  });

  it('drops the capture when globally paused', async () => {
    await setSettings({ ...defaultSettings, paused: true });
    const reply = await handleMessage(validPromptMessage(), sender);
    expect(reply).toEqual({ ok: true, data: { dropped: 'paused' } });
    expect(await db.prompts.count()).toBe(0);
  });

  it('drops the capture when the platform is disabled', async () => {
    await setSettings({
      ...defaultSettings,
      perPlatformEnabled: { ...defaultSettings.perPlatformEnabled, chatgpt: false },
    });
    const reply = await handleMessage(validPromptMessage(), sender);
    expect(reply).toEqual({ ok: true, data: { dropped: 'platform-disabled' } });
    expect(await db.prompts.count()).toBe(0);
  });

  it('tolerates a sender without a tab url', async () => {
    const reply = await handleMessage(validPromptMessage(), {});
    expect(reply).toEqual({ ok: true });
    expect(await db.prompts.count()).toBe(1);
  });
});

describe('handleMessage — capture/error', () => {
  it('acknowledges the report without queueing anything', async () => {
    const reply = await handleMessage(
      { kind: 'capture/error', platform: 'claude', reason: 'selector missing' },
      sender,
    );
    expect(reply).toEqual({ ok: true });
    expect(await db.prompts.count()).toBe(0);
  });
});

describe('handleMessage — queue/status', () => {
  it('returns the current queue size', async () => {
    await handleMessage(validPromptMessage('a'), sender);
    await handleMessage(validPromptMessage('b'), sender);
    const reply = await handleMessage({ kind: 'queue/status' }, sender);
    expect(reply).toEqual({ ok: true, data: { size: 2 } });
  });
});

describe('handleMessage — settings/get and settings/set', () => {
  it('returns current settings via settings/get', async () => {
    const reply = await handleMessage({ kind: 'settings/get' }, sender);
    expect(reply).toEqual({ ok: true, data: defaultSettings });
  });

  it('persists new settings via settings/set', async () => {
    const next = { ...defaultSettings, paused: true };
    const reply = await handleMessage({ kind: 'settings/set', settings: next }, sender);
    expect(reply).toEqual({ ok: true });

    const after = await handleMessage({ kind: 'settings/get' }, sender);
    expect(after).toEqual({ ok: true, data: next });
  });
});
