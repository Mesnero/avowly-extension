import { env } from './env.js';

/**
 * Tiny scoped logger. We don't ship pino into the extension — V8's bundle
 * budget is tight and we don't have a Loki collector in the browser anyway.
 *
 * Usage:
 *   const log = createLogger('chatgpt-adapter');
 *   log.info('captured', { length: text.length });
 *
 * Each line gets a stable prefix so filtering in DevTools is easy:
 *   [avowly:chatgpt-adapter] captured { length: 42 }
 *
 * In production builds, `debug` is dropped unless WXT_PUBLIC_DEBUG=true so the
 * console isn't polluted on user machines.
 */
export interface Logger {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

export function createLogger(scope: string): Logger {
  const prefix = `[avowly:${scope}]`;
  /* eslint-disable no-console */
  return {
    debug: (msg, meta) => {
      if (env.DEBUG) console.debug(prefix, msg, meta ?? '');
    },
    info: (msg, meta) => {
      console.info(prefix, msg, meta ?? '');
    },
    warn: (msg, meta) => {
      console.warn(prefix, msg, meta ?? '');
    },
    error: (msg, meta) => {
      console.error(prefix, msg, meta ?? '');
    },
  };
  /* eslint-enable no-console */
}
