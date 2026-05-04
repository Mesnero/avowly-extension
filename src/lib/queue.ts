import Dexie, { type Table } from 'dexie';

import { CapturedPrompt } from './schemas.js';

/**
 * Persistent capture queue. Survives browser restarts; nothing here is lost
 * to a crashed service worker.
 *
 * Schema is intentionally minimal. We add fields when there's a concrete need.
 */

export interface QueueRow {
  /** Same id as `CapturedPrompt.id`, the UUIDv7 idempotency key. */
  id: string;
  /** Frozen `CapturedPrompt` payload. We re-validate on read. */
  payload: CapturedPrompt;
  /** ms epoch when enqueued. */
  enqueuedAt: number;
  /** Send attempts so far. */
  attempts: number;
  /** Last attempt error (for the dead-letter view). */
  lastError: string | null;
}

class Database extends Dexie {
  prompts!: Table<QueueRow, string>;

  constructor() {
    super('avowly');
    this.version(1).stores({
      prompts: 'id, enqueuedAt, attempts',
    });
  }
}

export const db = new Database();

/** Add a freshly captured prompt to the queue. Idempotent on `id`. */
export async function enqueue(prompt: CapturedPrompt): Promise<void> {
  CapturedPrompt.parse(prompt);
  await db.prompts.put({
    id: prompt.id,
    payload: prompt,
    enqueuedAt: Date.now(),
    attempts: 0,
    lastError: null,
  });
}

/** Drain up to `limit` prompts. Caller is responsible for `delete()` on success. */
export async function peek(limit: number): Promise<QueueRow[]> {
  return db.prompts.orderBy('enqueuedAt').limit(limit).toArray();
}

export async function markFailure(id: string, error: string): Promise<void> {
  await db.prompts
    .where('id')
    .equals(id)
    .modify((row) => {
      row.attempts += 1;
      row.lastError = error;
    });
}

export async function remove(id: string): Promise<void> {
  await db.prompts.delete(id);
}

export async function size(): Promise<number> {
  return db.prompts.count();
}

export async function clear(): Promise<void> {
  await db.prompts.clear();
}
