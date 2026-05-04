import { getAuthToken } from '../lib/auth.js';
import { env } from '../lib/env.js';
import { createLogger } from '../lib/logger.js';
import { clear, deadLetter, markFailure, peek, remove, totalSize } from '../lib/queue.js';

const log = createLogger('sync');

const BATCH_SIZE = 50;

/**
 * Invoked by chrome.alarms on a periodic schedule.
 * Drains the queue and POSTs to the platform API.
 */
export async function onSyncTick(): Promise<void> {
  const token = await getAuthToken();
  if (!token) {
    const qSize = await totalSize();
    if (qSize > 0) {
      log.info('Wiping queue because user is unauthenticated', { size: qSize });
      await clear();
    } else {
      log.debug('Skipping sync tick: no auth token available');
    }
    return;
  }

  const batch = await peek(BATCH_SIZE);
  if (batch.length === 0) {
    return;
  }

  log.info(`Sync tick started, processing ${String(batch.length)} prompts`);

  for (const row of batch) {
    try {
      const response = await fetch(`${env.API_BASE_URL}/v1/prompts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          client_idempotency_key: row.payload.id,
          platform: row.payload.platform,
          text: row.payload.text,
          captured_at: new Date(row.payload.capturedAt).toISOString(),
          conversation_id: row.payload.conversationId,
          extension_version: row.payload.extensionVersion,
        }),
      });

      if (response.ok) {
        await remove(row.id);
      } else if (response.status === 401) {
        // Session expired or revoked server-side. Treat this the same as
        // a sign-out event: wipe the local queue so stale captures don't
        // accumulate indefinitely under a dead token.
        log.info('Received 401 from API — session revoked, wiping local queue');
        await clear();
        return;
      } else {
        const text = await response.text().catch(() => '');
        const reason = `HTTP ${String(response.status)}: ${text}`;

        if (isPermanentClientError(response.status)) {
          await deadLetter(row.id, reason);
          log.warn('Dead-lettering prompt after permanent sync failure', {
            id: row.id,
            status: response.status,
            body: text,
          });
          continue;
        }

        // Transient failures stop the loop so we do not spam the API.
        // 429/5xx/network errors retry on the next alarm tick.
        await markFailure(row.id, reason);
        log.warn('Failed to sync prompt', { id: row.id, status: response.status, body: text });
        break;
      }
    } catch (err: unknown) {
      const e = err instanceof Error ? err.message : String(err);
      await markFailure(row.id, e);
      log.error('Network error during sync', { id: row.id, message: e });
      break;
    }
  }
}

function isPermanentClientError(status: number): boolean {
  return status === 400 || status === 422;
}
