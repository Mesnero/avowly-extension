import { getAuthToken } from '../lib/auth.js';
import { env } from '../lib/env.js';
import { createLogger } from '../lib/logger.js';
import { clear, markFailure, peek, remove, size } from '../lib/queue.js';

const log = createLogger('sync');

const BATCH_SIZE = 50;

/**
 * Invoked by chrome.alarms on a periodic schedule.
 * Drains the queue and POSTs to the platform API.
 */
export async function onSyncTick(): Promise<void> {
  const token = await getAuthToken();
  if (!token) {
    const qSize = await size();
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
        // Any other 4xx/5xx: abort the loop to avoid spamming the API.
        // 429/500 will be retried on the next alarm tick; a 400 should
        // be investigated via the dead-letter view.
        const text = await response.text().catch(() => '');
        await markFailure(row.id, `HTTP ${String(response.status)}: ${text}`);
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
