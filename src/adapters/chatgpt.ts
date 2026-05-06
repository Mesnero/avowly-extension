import { uuidv7 } from '../lib/ids.js';

import type { AdapterContext, AdapterHandle, PlatformAdapter } from './base.js';

export const chatgptAdapter: PlatformAdapter = {
  id: 'chatgpt',
  matches: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],

  init(ctx: AdapterContext): AdapterHandle {
    ctx.log.info('initializing chatgpt adapter');

    const PROMPT_TEXTAREA_SELECTOR = '#prompt-textarea';
    const SEND_BUTTON_SELECTOR = 'button[data-testid="send-button"], #composer-submit-button';

    function extractPromptText(): string | null {
      const textarea = document.querySelector(PROMPT_TEXTAREA_SELECTOR);
      if (!textarea) return null;

      // ChatGPT uses a contenteditable div, not a real <textarea>. `innerText`
      // respects visual line-breaks produced by <br> and block elements, giving
      // us the text exactly as the user sees it. `textContent` concatenates raw
      // DOM text nodes and loses line structure for multi-line prompts.
      const text = (textarea as HTMLElement).innerText.trim();
      return text.length > 0 ? text : null;
    }

    // A single user action (clicking the send button) can fire both
    // `click` and `submit` on the same form. Dedupe within a short
    // window so we emit once per user submission, not once per event.
    const DEDUP_WINDOW_MS = 200;
    let lastCapturedAt = 0;

    function captureAndEmit() {
      const now = Date.now();
      if (now - lastCapturedAt < DEDUP_WINDOW_MS) return;
      const text = extractPromptText();
      if (!text) return;

      lastCapturedAt = now;
      ctx.log.debug('capturing chatgpt prompt', { length: text.length });
      ctx.emit({
        id: uuidv7(),
        platform: 'chatgpt',
        text,
        capturedAt: now,
      });
    }

    function handleClick(event: MouseEvent) {
      const target = event.target as Element | null;
      if (!target) return;

      // Capture only when the actual send button is clicked (or its
      // descendant icon). ChatGPT funnels Enter through the same React
      // submit handler that fires the click, so this single hook covers
      // mouse, keyboard Enter, and voice-input submission paths.
      if (target.closest(SEND_BUTTON_SELECTOR)) {
        captureAndEmit();
      }
    }

    function handleSubmit(event: SubmitEvent) {
      // Belt-and-braces: any <form> ancestor of the prompt area firing
      // a real submit event also triggers a capture. Covers programmatic
      // submits and any future UI variant that swaps the visible button
      // for a different element while keeping a real form.
      const form = event.target as Element | null;
      if (form?.querySelector(PROMPT_TEXTAREA_SELECTOR)) {
        captureAndEmit();
      }
    }

    document.addEventListener('click', handleClick, { capture: true, signal: ctx.signal });
    document.addEventListener('submit', handleSubmit, { capture: true, signal: ctx.signal });

    return {
      dispose() {
        ctx.log.info('disposing chatgpt adapter');
        // Event listeners are automatically removed via ctx.signal
      },
    };
  },
};
