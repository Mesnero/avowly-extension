import { useEffect, useState } from 'react';
import { SignIn, UserButton, useAuth } from '@clerk/chrome-extension';

import { defaultSettings, getSettings, setSettings, type Settings } from '../../lib/settings.js';

/**
 * Minimal popup UI: pause/resume, queue size, link to dashboard. Real layout
 * + balance summary lands when the API is wired and we have something to show.
 */
export function Popup() {
  const [settings, setLocal] = useState<Settings>(defaultSettings);
  const [loaded, setLoaded] = useState(false);
  const { isLoaded, userId } = useAuth();

  useEffect(() => {
    void getSettings().then((s) => {
      setLocal(s);
      setLoaded(true);
    });
  }, []);

  async function togglePaused(): Promise<void> {
    const next: Settings = { ...settings, paused: !settings.paused };
    setLocal(next);
    await setSettings(next);
  }

  if (!isLoaded) return null;

  return (
    <main className="flex w-[320px] flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Avowly</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">v{chrome.runtime.getManifest().version}</span>
          {userId && <UserButton />}
        </div>
      </header>

      {!userId ? (
        <div className="flex flex-col items-center justify-center pt-2">
          <SignIn routing="hash" />
        </div>
      ) : (
        <>
          <div className="rounded-md border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{settings.paused ? 'Paused' : 'Active'}</div>
                <p className="text-xs text-neutral-500">
                  {settings.paused
                    ? 'No prompts are being captured.'
                    : 'Capturing on supported AI platforms.'}
                </p>
              </div>
              <button
                type="button"
                disabled={!loaded}
                onClick={() => {
                  void togglePaused();
                }}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-40"
              >
                {settings.paused ? 'Resume' : 'Pause'}
              </button>
            </div>
          </div>

          <a
            href="https://app.avowly.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-center text-sm font-medium text-neutral-700 underline-offset-2 hover:underline"
          >
            Open dashboard
          </a>
        </>
      )}
    </main>
  );
}
