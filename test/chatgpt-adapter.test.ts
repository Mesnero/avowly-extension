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

  it('captures prompt on form submit (programmatic / Enter via React handler)', () => {
    const handle = chatgptAdapter.init(ctx);

    const form = document.querySelector('form')!;
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));

    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'chatgpt',
        text: 'This is a test prompt to see if the adapter captures it properly.',
      }),
    );

    handle.dispose();
  });

  it('emits once when click and submit fire for the same user action', () => {
    const handle = chatgptAdapter.init(ctx);

    const sendButton = document.querySelector<HTMLButtonElement>('#composer-submit-button')!;
    const form = document.querySelector('form')!;

    sendButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));

    expect(emitMock).toHaveBeenCalledTimes(1);
    handle.dispose();
  });

  it('does NOT capture on Enter keydown — submit/click is the only signal', () => {
    const handle = chatgptAdapter.init(ctx);
    const textarea = document.querySelector<HTMLDivElement>('#prompt-textarea')!;

    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );

    expect(emitMock).not.toHaveBeenCalled();
    handle.dispose();
  });

  it('does NOT capture empty prompts on submit', () => {
    const handle = chatgptAdapter.init(ctx);
    const textarea = document.querySelector<HTMLDivElement>('#prompt-textarea')!;
    // Replace the text content with whitespace; innerText.trim() will
    // return '' so capture should be a no-op.
    textarea.replaceChildren(document.createTextNode('   '));

    const form = document.querySelector('form')!;
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true }));

    expect(emitMock).not.toHaveBeenCalled();
    handle.dispose();
  });

  it('emits a UUIDv7 idempotency key', () => {
    const handle = chatgptAdapter.init(ctx);
    const form = document.querySelector('form')!;
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true }));

    expect(emitMock).toHaveBeenCalledTimes(1);
    const id = (emitMock.mock.calls[0]?.[0] as { id: string } | undefined)?.id ?? '';
    // UUIDv7: third group starts with `7`.
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    handle.dispose();
  });
});
