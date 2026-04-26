import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { uuidv7 } from '../src/lib/ids.js';
import { db, enqueue, markFailure, peek, remove, size } from '../src/lib/queue.js';
import type { CapturedPrompt } from '../src/lib/schemas.js';

function makePrompt(overrides: Partial<CapturedPrompt> = {}): CapturedPrompt {
  return {
    id: uuidv7(),
    platform: 'chatgpt',
    text: 'hello world',
    capturedAt: Date.now(),
    extensionVersion: '0.0.0-test',
    ...overrides,
  };
}

beforeEach(async () => {
  await db.prompts.clear();
});

afterEach(async () => {
  await db.prompts.clear();
});

describe('queue.enqueue', () => {
  it('persists a row keyed by the prompt id', async () => {
    const prompt = makePrompt();
    await enqueue(prompt);
    const row = await db.prompts.get(prompt.id);
    expect(row).toBeDefined();
    expect(row?.payload).toEqual(prompt);
    expect(row?.attempts).toBe(0);
    expect(row?.lastError).toBeNull();
  });

  it('is idempotent on the prompt id (put-semantics)', async () => {
    const prompt = makePrompt();
    await enqueue(prompt);
    await enqueue(prompt);
    expect(await size()).toBe(1);
  });

  it('rejects an invalid payload before writing', async () => {
    const bad = { ...makePrompt(), platform: 'mistral' as unknown as CapturedPrompt['platform'] };
    await expect(enqueue(bad)).rejects.toThrow();
    expect(await size()).toBe(0);
  });
});

describe('queue.peek', () => {
  it('returns up to `limit` rows in enqueue order', async () => {
    // Drive Date.now() with a fake clock so enqueuedAt is strictly
    // increasing across the three writes — the real clock has ms
    // resolution and three same-tick enqueues would tie.
    let now = 1_700_000_000_000;
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => ++now);
    try {
      await enqueue(makePrompt({ text: 'first' }));
      await enqueue(makePrompt({ text: 'second' }));
      await enqueue(makePrompt({ text: 'third' }));
    } finally {
      spy.mockRestore();
    }

    const head = await peek(2);
    expect(head).toHaveLength(2);
    expect(head[0]?.payload.text).toBe('first');
    expect(head[1]?.payload.text).toBe('second');
  });

  it('returns an empty array when the queue is empty', async () => {
    expect(await peek(10)).toEqual([]);
  });
});

describe('queue.markFailure', () => {
  it('increments attempts and records the error', async () => {
    const prompt = makePrompt();
    await enqueue(prompt);
    await markFailure(prompt.id, 'first attempt failed');
    await markFailure(prompt.id, 'second attempt failed');

    const row = await db.prompts.get(prompt.id);
    expect(row?.attempts).toBe(2);
    expect(row?.lastError).toBe('second attempt failed');
  });
});

describe('queue.remove', () => {
  it('drops a row by id', async () => {
    const prompt = makePrompt();
    await enqueue(prompt);
    expect(await size()).toBe(1);
    await remove(prompt.id);
    expect(await size()).toBe(0);
  });
});

describe('queue.size', () => {
  it('counts current rows', async () => {
    expect(await size()).toBe(0);
    await enqueue(makePrompt());
    await enqueue(makePrompt());
    expect(await size()).toBe(2);
  });
});
