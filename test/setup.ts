import '@testing-library/jest-dom/vitest';

import { afterEach, beforeEach, vi } from 'vitest';

/**
 * Test environment setup. Mocks the parts of the WebExtensions API we use so
 * unit tests don't need a real browser. Adapter DOM tests run in happy-dom
 * (configured in vitest.config.ts).
 */

// Define global browser/chrome stubs at module load time to prevent webextension-polyfill
// from throwing "This script should only be loaded in a browser extension." during imports.
globalThis.chrome = { runtime: { id: 'test-init' } } as unknown as typeof chrome;
// @ts-expect-error browser is not on globalThis by default
globalThis.browser = globalThis.chrome;

interface InMemoryStorage {
  data: Record<string, unknown>;
  get: (keys: string | string[] | null) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  clear: () => Promise<void>;
}

function createStorage(): InMemoryStorage {
  return {
    data: {},
    get(keys) {
      if (keys === null) return Promise.resolve({ ...this.data });
      const list = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const k of list) {
        if (k in this.data) out[k] = this.data[k];
      }
      return Promise.resolve(out);
    },
    set(items) {
      Object.assign(this.data, items);
      return Promise.resolve();
    },
    clear() {
      this.data = {};
      return Promise.resolve();
    },
  };
}

beforeEach(() => {
  const sync = createStorage();
  const local = createStorage();
  const session = createStorage();

  globalThis.chrome = {
    storage: { sync, local, session },
    runtime: {
      id: 'avowly-test-extension-id',
      getManifest: () => ({ version: '0.0.0-test' }) as chrome.runtime.Manifest,
      sendMessage: vi.fn(() => Promise.resolve(undefined)),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    extension: {
      inIncognitoContext: false,
    },
    alarms: {
      create: vi.fn(),
      onAlarm: { addListener: vi.fn() },
    },
  } as unknown as typeof chrome;
});

afterEach(() => {
  vi.restoreAllMocks();
});
