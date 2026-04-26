import { describe, expect, it } from 'vitest';

import { CapturedPrompt, ExtensionMessage } from '../src/lib/schemas.js';
import { uuidv7 } from '../src/lib/ids.js';

describe('CapturedPrompt schema', () => {
  it('accepts a well-formed payload', () => {
    expect(() =>
      CapturedPrompt.parse({
        id: uuidv7(),
        platform: 'chatgpt',
        text: 'hello world',
        capturedAt: Date.now(),
        extensionVersion: '0.0.0',
      }),
    ).not.toThrow();
  });

  it('rejects an unknown platform', () => {
    expect(() =>
      CapturedPrompt.parse({
        id: uuidv7(),
        platform: 'mistral',
        text: 'x',
        capturedAt: Date.now(),
        extensionVersion: '0.0.0',
      }),
    ).toThrow();
  });

  it('rejects empty prompt text', () => {
    expect(() =>
      CapturedPrompt.parse({
        id: uuidv7(),
        platform: 'chatgpt',
        text: '',
        capturedAt: Date.now(),
        extensionVersion: '0.0.0',
      }),
    ).toThrow();
  });
});

describe('ExtensionMessage discriminated union', () => {
  it('parses a capture/prompt message', () => {
    const parsed = ExtensionMessage.parse({
      kind: 'capture/prompt',
      prompt: {
        id: uuidv7(),
        platform: 'chatgpt',
        text: 'hi',
        capturedAt: Date.now(),
        extensionVersion: '0.0.0',
      },
    });
    expect(parsed.kind).toBe('capture/prompt');
  });

  it('rejects an unknown kind', () => {
    expect(() => ExtensionMessage.parse({ kind: 'capture/everything' })).toThrow();
  });
});
