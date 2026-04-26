import { z } from 'zod';

import { PlatformId } from './schemas.js';

/**
 * User-visible settings. Stored in chrome.storage.sync so they ride along to
 * the user's other devices.
 *
 * IMPORTANT: chrome.storage.sync has a ~100KB total quota and ~8KB per item.
 * Don't put large objects here.
 */
export const Settings = z.object({
  /** Global pause — when true, no captures happen anywhere. */
  paused: z.boolean(),
  /** Per-platform on/off. Default: all enabled. */
  perPlatformEnabled: z.record(PlatformId, z.boolean()),
});
export type Settings = z.infer<typeof Settings>;

const DEFAULT_SETTINGS: Settings = {
  paused: false,
  perPlatformEnabled: {
    chatgpt: true,
    claude: true,
    gemini: true,
    perplexity: true,
  },
};

const KEY = 'avowly:settings';

/**
 * Read user settings. Returns the defaults if nothing is stored yet OR if the
 * stored value fails validation (corrupted-storage recovery).
 */
export async function getSettings(): Promise<Settings> {
  // `chrome.storage.sync.get` is typed as returning `{ [key: string]: any }`,
  // so we narrow the value to `unknown` before validating.
  const raw: Record<string, unknown> = await chrome.storage.sync.get(KEY);
  const stored: unknown = raw[KEY];
  const parsed = Settings.safeParse(stored);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function setSettings(settings: Settings): Promise<void> {
  Settings.parse(settings); // throws if invalid
  await chrome.storage.sync.set({ [KEY]: settings });
}

export const defaultSettings: Settings = DEFAULT_SETTINGS;
