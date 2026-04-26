import { describe, expect, it } from 'vitest';

import { defaultSettings, getSettings, setSettings } from '../src/lib/settings.js';

describe('settings', () => {
  it('returns defaults when storage is empty', async () => {
    const s = await getSettings();
    expect(s).toEqual(defaultSettings);
  });

  it('round-trips a valid settings object', async () => {
    await setSettings({
      paused: true,
      perPlatformEnabled: { chatgpt: false, claude: true, gemini: true, perplexity: true },
    });
    const s = await getSettings();
    expect(s.paused).toBe(true);
    expect(s.perPlatformEnabled.chatgpt).toBe(false);
  });

  it('falls back to defaults when stored value is corrupted', async () => {
    await chrome.storage.sync.set({ 'avowly:settings': { paused: 'oops' } });
    const s = await getSettings();
    // Corruption recovery: defaults, not the corrupt object.
    expect(s).toEqual(defaultSettings);
  });
});
