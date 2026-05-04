import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import type { AdapterContext } from '../src/adapters/base.js';
import { chatgptAdapter } from '../src/adapters/chatgpt.js';
import type { Logger } from '../src/lib/logger.js';

describe('ChatGPT Adapter', () => {
  let ctx: AdapterContext;
  let emitMock: ReturnType<typeof vi.fn>;
  let reportErrorMock: ReturnType<typeof vi.fn>;
  let abortController: AbortController;

  beforeEach(() => {
    // Load the HTML fixture into happy-dom
    const html = readFileSync(resolve(__dirname, './fixtures/chatgpt/basic-prompt.html'), 'utf8');
    document.body.innerHTML = html;

    emitMock = vi.fn();
    reportErrorMock = vi.fn();
    abortController = new AbortController();

    ctx = {
      emit: emitMock,
      reportError: reportErrorMock,
      log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        fatal: vi.fn(),
        trace: vi.fn(),
        child: vi.fn(),
      } as unknown as Logger,
      signal: abortController.signal,
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
    abortController.abort();
    vi.restoreAllMocks();
  });

  it('has the correct id and matches', () => {
    expect(chatgptAdapter.id).toBe('chatgpt');
    expect(chatgptAdapter.matches).toContain('https://chatgpt.com/*');
  });

  it('captures prompt on submit button click', () => {
    const handle = chatgptAdapter.init(ctx);

    const sendButton = document.querySelector<HTMLButtonElement>('#composer-submit-button')!;
    expect(sendButton).not.toBeNull();

    // Simulate click
    sendButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'chatgpt',
        text: 'This is a test prompt to see if the adapter captures it properly.',
      }),
    );

    handle.dispose();
  });

  it('captures prompt on Enter keydown in textarea', () => {
    const handle = chatgptAdapter.init(ctx);

    const textarea = document.querySelector<HTMLDivElement>('#prompt-textarea')!;
    expect(textarea).not.toBeNull();

    // Simulate Enter keydown
    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );

    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'chatgpt',
        text: 'This is a test prompt to see if the adapter captures it properly.',
      }),
    );

    handle.dispose();
  });

  it('does NOT capture on Shift+Enter keydown', () => {
    const handle = chatgptAdapter.init(ctx);
    const textarea = document.querySelector<HTMLDivElement>('#prompt-textarea')!;

    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }),
    );

    expect(emitMock).not.toHaveBeenCalled();
    handle.dispose();
  });

  it('does NOT capture empty prompts', () => {
    const handle = chatgptAdapter.init(ctx);
    const textarea = document.querySelector<HTMLDivElement>('#prompt-textarea')!;
    textarea.innerHTML = '    <br>    '; // Empty text content

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(emitMock).not.toHaveBeenCalled();
    handle.dispose();
  });
});
