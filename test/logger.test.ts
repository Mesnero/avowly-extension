import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLogger } from '../src/lib/logger.js';

vi.mock('../src/lib/env.js', () => ({
  env: { API_BASE_URL: 'https://api.example.test', DEBUG: false },
}));

describe('createLogger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefixes every line with the scope', () => {
    const log = createLogger('queue');
    log.info('drained', { count: 3 });
    expect(console.info).toHaveBeenCalledWith('[avowly:queue]', 'drained', { count: 3 });
  });

  it('passes empty meta as an empty string when none is given', () => {
    const log = createLogger('q');
    log.warn('warning');
    expect(console.warn).toHaveBeenCalledWith('[avowly:q]', 'warning', '');
  });

  it('drops debug logs when DEBUG is false', () => {
    const log = createLogger('q');
    log.debug('verbose');
    expect(console.debug).not.toHaveBeenCalled();
  });

  it('routes warn and error to the matching console methods', () => {
    const log = createLogger('q');
    log.warn('w');
    log.error('e');
    expect(console.warn).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledOnce();
  });
});

describe('createLogger with DEBUG=true', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('../src/lib/env.js', () => ({
      env: { API_BASE_URL: 'https://api.example.test', DEBUG: true },
    }));
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.doUnmock('../src/lib/env.js');
    vi.restoreAllMocks();
  });

  it('emits debug logs when DEBUG is true', async () => {
    const { createLogger: createLoggerDebug } = await import('../src/lib/logger.js');
    const log = createLoggerDebug('q');
    log.debug('verbose', { x: 1 });
    expect(console.debug).toHaveBeenCalledWith('[avowly:q]', 'verbose', { x: 1 });
  });
});
