import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, '../test/fixtures/chatgpt/basic-prompt.html');
const adapterEntryPath = resolve(here, '../src/adapters/chatgpt.ts');
const fixtureHtml = readFileSync(fixturePath, 'utf8');

async function bundleChatGptAdapter(): Promise<string> {
  const result = await build({
    entryPoints: [adapterEntryPath],
    bundle: true,
    format: 'iife',
    globalName: 'AvowlyAdapterSmoke',
    platform: 'browser',
    write: false,
  });

  const output = result.outputFiles[0];
  if (output === undefined) {
    throw new Error('esbuild did not emit the ChatGPT adapter smoke bundle');
  }
  return output.text;
}

test('ChatGPT adapter captures fixture submissions in a browser', async ({ page }) => {
  const adapterBundle = await bundleChatGptAdapter();
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error);
  });

  await page.setContent(fixtureHtml);

  const promptInput = page.locator('#prompt-textarea');
  const sendButton = page.locator('button[data-testid="send-button"]');
  const captures: CapturedSmokePrompt[] = [];

  await page.exposeFunction('recordCapture', (prompt: CapturedSmokePrompt) => {
    captures.push(prompt);
  });
  await page.addScriptTag({ content: adapterBundle });
  await page.evaluate(() => {
    const send = document.querySelector<HTMLButtonElement>('button[data-testid="send-button"]');
    const form = send?.closest('form');
    if (!send) {
      throw new Error('fixture is missing send control');
    }

    form?.addEventListener('submit', (event) => {
      event.preventDefault();
    });
    if (typeof crypto.randomUUID !== 'function') {
      Object.defineProperty(crypto, 'randomUUID', {
        value: () => '00000000-0000-4000-8000-000000000000',
      });
    }

    const noop = () => undefined;
    const log = {
      info: noop,
      error: noop,
      warn: noop,
      debug: noop,
      fatal: noop,
      trace: noop,
      child: () => log,
    };

    window.AvowlyAdapterSmoke.chatgptAdapter.init({
      emit: (prompt) => {
        void window.recordCapture(prompt);
      },
      reportError: (reason) => {
        throw new Error(reason);
      },
      log,
      signal: new AbortController().signal,
    });
  });

  await expect(promptInput).toBeEditable();
  await expect(sendButton).toBeVisible();
  await expect(sendButton).toHaveAccessibleName('Aufforderung senden');

  await sendButton.click();
  await promptInput.press('Enter');

  await expect.poll(() => captures.length).toBe(2);
  expect(pageErrors).toEqual([]);
  expect(captures).toEqual([
    expect.objectContaining({
      platform: 'chatgpt',
      text: 'This is a test prompt to see if the adapter captures it properly.',
    }),
    expect.objectContaining({
      platform: 'chatgpt',
      text: 'This is a test prompt to see if the adapter captures it properly.',
    }),
  ]);
  expect(captures.every((capture) => typeof capture.id === 'string')).toBe(true);
  expect(captures.every((capture) => typeof capture.capturedAt === 'number')).toBe(true);
});

interface CapturedSmokePrompt {
  id: string;
  platform: 'chatgpt';
  text: string;
  capturedAt: number;
}

declare global {
  interface Window {
    AvowlyAdapterSmoke: {
      chatgptAdapter: {
        init: (ctx: {
          emit: (prompt: CapturedSmokePrompt) => void;
          reportError: (reason: string) => void;
          log: Record<string, unknown>;
          signal: AbortSignal;
        }) => void;
      };
    };
    recordCapture: (prompt: CapturedSmokePrompt) => void;
  }
}
