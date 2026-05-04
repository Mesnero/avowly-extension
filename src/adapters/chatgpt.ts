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

    function captureAndEmit() {
      const text = extractPromptText();
      if (!text) return;

      ctx.log.debug('capturing chatgpt prompt', { length: text.length });
      ctx.emit({
        id: crypto.randomUUID(),
        platform: 'chatgpt',
        text,
        capturedAt: Date.now(),
      });
    }

    function handleKeyDown(event: KeyboardEvent) {
      // ChatGPT submits on 'Enter' (without Shift) unless the user is still composing an IME character.
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing) {
        return;
      }

      const target = event.target as Element | null;
      if (target?.matches(PROMPT_TEXTAREA_SELECTOR)) {
        // Run capture before the React event loop clears the textarea value
        captureAndEmit();
      }
    }

    function handleClick(event: MouseEvent) {
      const target = event.target as Element | null;
      if (!target) return;

      // Check if the clicked element or its ancestor is the send button
      if (target.closest(SEND_BUTTON_SELECTOR)) {
        captureAndEmit();
      }
    }

    // Attach in capture phase to intercept events before React handlers clear the input
    document.addEventListener('keydown', handleKeyDown, { capture: true, signal: ctx.signal });
    document.addEventListener('click', handleClick, { capture: true, signal: ctx.signal });

    return {
      dispose() {
        ctx.log.info('disposing chatgpt adapter');
        // Event listeners are automatically removed via ctx.signal
      },
    };
  },
};
