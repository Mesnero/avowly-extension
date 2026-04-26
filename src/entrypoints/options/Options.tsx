import { useEffect, useState } from 'react';

import { defaultSettings, getSettings, setSettings, type Settings } from '../../lib/settings.js';
import type { PlatformId } from '../../lib/schemas.js';

const PLATFORMS: { id: PlatformId; label: string; host: string }[] = [
  { id: 'chatgpt', label: 'ChatGPT', host: 'chatgpt.com' },
  { id: 'claude', label: 'Claude', host: 'claude.ai' },
  { id: 'gemini', label: 'Gemini', host: 'gemini.google.com' },
  { id: 'perplexity', label: 'Perplexity', host: 'perplexity.ai' },
];

export function Options() {
  const [settings, setLocal] = useState<Settings>(defaultSettings);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void getSettings().then((s) => {
      setLocal(s);
      setLoaded(true);
    });
  }, []);

  async function updatePlatform(id: PlatformId, enabled: boolean): Promise<void> {
    const next: Settings = {
      ...settings,
      perPlatformEnabled: { ...settings.perPlatformEnabled, [id]: enabled },
    };
    setLocal(next);
    await setSettings(next);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Avowly settings</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Choose which AI platforms Avowly captures from. Anything off here is never recorded.
      </p>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Platforms
        </h2>
        <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
          {PLATFORMS.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-sm font-medium">{p.label}</div>
                <div className="text-xs text-neutral-500">{p.host}</div>
              </div>
              <input
                type="checkbox"
                disabled={!loaded}
                checked={settings.perPlatformEnabled[p.id] ?? false}
                onChange={(e) => {
                  void updatePlatform(p.id, e.currentTarget.checked);
                }}
                className="h-4 w-4 cursor-pointer accent-neutral-900"
                aria-label={`Capture on ${p.label}`}
              />
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 text-xs text-neutral-500">
        See full controls and your captured prompts at{' '}
        <a
          href="https://app.avowly.io"
          className="underline-offset-2 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          app.avowly.io
        </a>
        .
      </p>
    </main>
  );
}
