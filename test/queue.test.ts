import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { uuidv7 } from '../src/lib/ids.js';
import {
  MAX_TRANSIENT_ATTEMPTS,
  db,
  deadLetter,
  deadLetterSize,
  enqueue,
  markFailure,
  peek,
  remove,
  size,
  stats,
  totalSize,
} from '../src/lib/queue.js';
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
    expect(row?.deadLetteredAt).toBeNull();
    expect(row?.deadLetterReason).toBeNull();
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

  it('skips dead-lettered rows without deleting them', async () => {
    const bad = makePrompt({ text: 'bad' });
    await enqueue(bad);
    await enqueue(makePrompt({ text: 'good' }));

    await deadLetter(bad.id, 'HTTP 400: invalid');

    const active = await peek(10);
    expect(active).toHaveLength(1);
    expect(active[0]?.payload.text).toBe('good');
    expect(await size()).toBe(1);
    expect(await totalSize()).toBe(2);
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
    expect(row?.deadLetteredAt).toBeNull();
  });

  it('promotes the row to dead-letter once the transient cap is reached', async () => {
    const prompt = makePrompt();
    await enqueue(prompt);

    for (let i = 0; i < MAX_TRANSIENT_ATTEMPTS; i++) {
      await markFailure(prompt.id, `attempt ${String(i + 1)} failed`);
    }

    const row = await db.prompts.get(prompt.id);
    expect(row?.attempts).toBe(MAX_TRANSIENT_ATTEMPTS);
    expect(row?.deadLetteredAt).toEqual(expect.any(Number));
    expect(row?.deadLetterReason).toContain(`Exceeded ${String(MAX_TRANSIENT_ATTEMPTS)} attempts`);
    expect(await peek(10)).toEqual([]);
  });
});

describe('queue.deadLetter', () => {
  it('records permanent failure metadata and removes the row from peek', async () => {
    const prompt = makePrompt();
    await enqueue(prompt);

    await deadLetter(prompt.id, 'HTTP 400: bad request');

    const row = await db.prompts.get(prompt.id);
    expect(row?.attempts).toBe(1);
    expect(row?.lastError).toBe('HTTP 400: bad request');
    expect(row?.deadLetterReason).toBe('HTTP 400: bad request');
    expect(row?.deadLetteredAt).toEqual(expect.any(Number));
    expect(await peek(10)).toEqual([]);
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
  it('counts only syncable rows', async () => {
    expect(await size()).toBe(0);
    const dead = makePrompt();
    await enqueue(dead);
    await enqueue(makePrompt());
    await deadLetter(dead.id, 'HTTP 400: invalid');
    expect(await size()).toBe(1);
  });
});

describe('queue.stats', () => {
  it('separates pending, dead-lettered, and total rows', async () => {
    const dead = makePrompt();
    await enqueue(dead);
    await enqueue(makePrompt());
    await deadLetter(dead.id, 'HTTP 400: invalid');

    expect(await deadLetterSize()).toBe(1);
    expect(await totalSize()).toBe(2);
    expect(await stats()).toEqual({ pending: 1, deadLettered: 1, total: 2 });
  });
});
