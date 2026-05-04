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
  /** ms epoch when the row was permanently stopped. Null/missing means still syncable. */
  deadLetteredAt?: number | null;
  /** Permanent failure reason shown in the future dead-letter view. */
  deadLetterReason?: string | null;
}

export interface QueueStats {
  pending: number;
  deadLettered: number;
  total: number;
}

class Database extends Dexie {
  prompts!: Table<QueueRow, string>;

  constructor() {
    super('avowly');
    this.version(1).stores({
      prompts: 'id, enqueuedAt, attempts',
    });
    this.version(2)
      .stores({
        prompts: 'id, enqueuedAt, attempts, deadLetteredAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table<QueueRow, string>('prompts')
          .toCollection()
          .modify((row) => {
            row.deadLetteredAt ??= null;
            row.deadLetterReason ??= null;
          });
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
    deadLetteredAt: null,
    deadLetterReason: null,
  });
}

/** Drain up to `limit` syncable prompts. Caller is responsible for `delete()` on success. */
export async function peek(limit: number): Promise<QueueRow[]> {
  return db.prompts
    .orderBy('enqueuedAt')
    .filter((row) => row.deadLetteredAt === null || row.deadLetteredAt === undefined)
    .limit(limit)
    .toArray();
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

export async function deadLetter(id: string, reason: string): Promise<void> {
  await db.prompts
    .where('id')
    .equals(id)
    .modify((row) => {
      row.attempts += 1;
      row.lastError = reason;
      row.deadLetteredAt = Date.now();
      row.deadLetterReason = reason;
    });
}

export async function remove(id: string): Promise<void> {
  await db.prompts.delete(id);
}

export async function pendingSize(): Promise<number> {
  return db.prompts
    .filter((row) => row.deadLetteredAt === null || row.deadLetteredAt === undefined)
    .count();
}

export async function deadLetterSize(): Promise<number> {
  return db.prompts
    .filter((row) => row.deadLetteredAt !== null && row.deadLetteredAt !== undefined)
    .count();
}

export async function stats(): Promise<QueueStats> {
  const [pending, deadLettered, total] = await Promise.all([
    pendingSize(),
    deadLetterSize(),
    db.prompts.count(),
  ]);
  return { pending, deadLettered, total };
}

export async function size(): Promise<number> {
  return pendingSize();
}

export async function totalSize(): Promise<number> {
  return db.prompts.count();
}

export async function clear(): Promise<void> {
  await db.prompts.clear();
}
