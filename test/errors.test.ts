import { describe, expect, it } from 'vitest';

import {
  AuthError,
  CaptureError,
  ExtensionError,
  QueueError,
  SyncError,
  toExtensionError,
} from '../src/lib/errors.js';

describe('ExtensionError hierarchy', () => {
  it('CaptureError carries its code and meta', () => {
    const err = new CaptureError('bad capture', { meta: { platform: 'chatgpt' } });
    expect(err.code).toBe('CAPTURE_ERROR');
    expect(err.message).toBe('bad capture');
    expect(err.meta).toEqual({ platform: 'chatgpt' });
    expect(err.name).toBe('CaptureError');
    expect(err).toBeInstanceOf(ExtensionError);
  });

  it('QueueError, SyncError, AuthError carry their codes', () => {
    expect(new QueueError('q').code).toBe('QUEUE_ERROR');
    expect(new SyncError('s').code).toBe('SYNC_ERROR');
    expect(new AuthError('a').code).toBe('AUTH_ERROR');
  });

  it('forwards a cause when provided', () => {
    const root = new Error('root');
    const wrapped = new SyncError('wrap', { cause: root });
    expect(wrapped.cause).toBe(root);
  });

  it('omits the cause option when none is provided', () => {
    // The constructor must NOT pass `cause: undefined` to Error — that would
    // set the property explicitly under exactOptionalPropertyTypes.
    const err = new CaptureError('plain');
    expect('cause' in err).toBe(false);
  });
});

describe('toExtensionError', () => {
  it('passes through ExtensionError instances unchanged', () => {
    const original = new CaptureError('x');
    expect(toExtensionError(original)).toBe(original);
  });

  it('wraps a generic Error as a SyncError preserving the cause', () => {
    const root = new Error('boom');
    const wrapped = toExtensionError(root);
    expect(wrapped).toBeInstanceOf(SyncError);
    expect(wrapped.message).toBe('boom');
    expect(wrapped.cause).toBe(root);
  });

  it('wraps a non-Error value as a SyncError with the value in meta', () => {
    const wrapped = toExtensionError({ weird: true });
    expect(wrapped).toBeInstanceOf(SyncError);
    expect(wrapped.message).toBe('Unknown error');
    expect(wrapped.meta).toEqual({ value: { weird: true } });
  });
});
