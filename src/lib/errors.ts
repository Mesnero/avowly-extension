/**
 * Extension-side error hierarchy. Mirrors the API's hierarchy in shape so a
 * single `formatError(err)` works on both sides of the wire.
 *
 * Importantly, errors thrown inside content scripts *cannot* leak via Sentry
 * automatically — content scripts are sandboxed. The background service worker
 * collects errors via `runtime.sendMessage` from content scripts and reports
 * them centrally (added when we wire telemetry).
 */
export abstract class ExtensionError extends Error {
  abstract readonly code: string;
  readonly meta: Record<string, unknown> | undefined;

  constructor(message: string, opts: { cause?: unknown; meta?: Record<string, unknown> } = {}) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = this.constructor.name;
    this.meta = opts.meta;
  }
}

export class CaptureError extends ExtensionError {
  readonly code = 'CAPTURE_ERROR';
}

export class QueueError extends ExtensionError {
  readonly code = 'QUEUE_ERROR';
}

export class SyncError extends ExtensionError {
  readonly code = 'SYNC_ERROR';
}

export class AuthError extends ExtensionError {
  readonly code = 'AUTH_ERROR';
}

export function toExtensionError(err: unknown): ExtensionError {
  if (err instanceof ExtensionError) return err;
  if (err instanceof Error) {
    // Wrap unknown errors as SyncError — they almost always come from the
    // sync path. More specific wrapping happens at the call site.
    return new SyncError(err.message, { cause: err });
  }
  return new SyncError('Unknown error', { meta: { value: err } });
}
