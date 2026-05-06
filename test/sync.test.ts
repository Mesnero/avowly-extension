import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { onSyncTick } from '../src/background/sync.js';
import * as auth from '../src/lib/auth.js';
import { uuidv7 } from '../src/lib/ids.js';
import { db, deadLetter, enqueue, peek, size } from '../src/lib/queue.js';
import type { CapturedPrompt } from '../src/lib/schemas.js';

function makePrompt(overrides: Partial<CapturedPrompt> = {}): CapturedPrompt {
  return {
    id: uuidv7(),
    platform: 'chatgpt',
    text: 'hello context',
    capturedAt: Date.now(),
    extensionVersion: '0.0.0-test',
    ...overrides,
  };
}

describe('background/sync', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    global.fetch = fetchMock as any;
    vi.spyOn(auth, 'getAuthToken').mockResolvedValue('test-token');
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    await db.prompts.clear();
  });

  it('does nothing if auth token is missing and queue is empty', async () => {
    vi.spyOn(auth, 'getAuthToken').mockResolvedValue(null);
    await onSyncTick();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await size()).toBe(0);
  });

  it('holds the queue when auth token is missing — does not wipe', async () => {
    vi.spyOn(auth, 'getAuthToken').mockResolvedValue(null);
    await enqueue(makePrompt());
    await enqueue(makePrompt());
    expect(await size()).toBe(2);

    await onSyncTick();

    // No fetch and no wipe: a missing token may be a transient
    // refresh blip, not a real sign-out. The 401 handler is the only
    // path that destroys local captures.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await size()).toBe(2);
  });

  it('does not touch dead-lettered captures when the auth token is missing', async () => {
    vi.spyOn(auth, 'getAuthToken').mockResolvedValue(null);
    const prompt = makePrompt({ text: 'dead letter survives token blip' });
    await enqueue(prompt);
    await deadLetter(prompt.id, 'HTTP 400: invalid');

    await onSyncTick();

    expect(fetchMock).not.toHaveBeenCalled();
    const row = await db.prompts.get(prompt.id);
    expect(row?.deadLetterReason).toBe('HTTP 400: invalid');
  });

  it('drains the queue on success', async () => {
    const p1 = makePrompt({ text: 'first' });
    const p2 = makePrompt({ text: 'second' });
    await enqueue(p1);
    vi.advanceTimersByTime(1);
    await enqueue(p2);

    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ status: 'queued' }),
    });

    await onSyncTick();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await size()).toBe(0);

    const firstCallParams = fetchMock.mock.calls[0]![1] as RequestInit | undefined;
    const bodyStr = typeof firstCallParams?.body === 'string' ? firstCallParams.body : '';
    const body = JSON.parse(bodyStr) as { text: string; client_idempotency_key: string };
    expect(firstCallParams!.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-token',
    });
    expect(body.text).toBe('first');
    expect(body.client_idempotency_key).toBe(p1.id);
  });

  it('wipes the queue on 401 (session revoked server-side)', async () => {
    await enqueue(makePrompt());
    vi.advanceTimersByTime(1);
    await enqueue(makePrompt());

    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('{"error":"unauthorized"}'),
    });

    await onSyncTick();

    // Fires once (first item), detects 401, then wipes and returns
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await size()).toBe(0);
  });

  it('marks failure and stops on non-401 error response', async () => {
    await enqueue(makePrompt());
    vi.advanceTimersByTime(1);
    await enqueue(makePrompt());

    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('rate limited'),
    });

    await onSyncTick();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Queue still has both items; first got a failure mark
    expect(await size()).toBe(2);
    const inQueue = await peek(10);
    expect(inQueue[0]?.attempts).toBe(1);
  });

  it('treats non-validation 4xx responses as retryable', async () => {
    await enqueue(makePrompt());
    vi.advanceTimersByTime(1);
    await enqueue(makePrompt());

    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('forbidden'),
    });

    await onSyncTick();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await peek(10)).toHaveLength(2);
    const rows = await db.prompts.orderBy('enqueuedAt').toArray();
    expect(rows[0]?.attempts).toBe(1);
    expect(rows[0]?.deadLetteredAt).toBeNull();
  });

  it('dead-letters permanent 4xx errors and continues with newer prompts', async () => {
    await enqueue(makePrompt({ text: 'bad payload' }));
    vi.advanceTimersByTime(1);
    await enqueue(makePrompt({ text: 'valid payload' }));

    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('invalid prompt'),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: () => Promise.resolve({ status: 'queued' }),
      });

    await onSyncTick();

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const active = await peek(10);
    expect(active).toEqual([]);

    const rows = await db.prompts.orderBy('enqueuedAt').toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload.text).toBe('bad payload');
    expect(rows[0]?.attempts).toBe(1);
    expect(rows[0]?.deadLetterReason).toBe('HTTP 400: invalid prompt');
    expect(rows[0]?.deadLetteredAt).toEqual(expect.any(Number));
  });

  it('stops processing on network error', async () => {
    await enqueue(makePrompt());
    vi.advanceTimersByTime(1);
    await enqueue(makePrompt());
    fetchMock.mockRejectedValue(new Error('Network error'));
    await onSyncTick();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await peek(10)).toHaveLength(2);
    expect((await peek(10))[0]?.attempts).toBe(1);
  });
});
