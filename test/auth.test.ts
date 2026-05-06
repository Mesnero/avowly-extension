import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AuthModule from '../src/lib/auth.js';

const { createClerkClientMock, getTokenMock } = vi.hoisted(() => ({
  createClerkClientMock: vi.fn(),
  getTokenMock: vi.fn(),
}));

vi.mock('@clerk/chrome-extension/client', () => ({
  createClerkClient: createClerkClientMock,
}));

beforeEach(() => {
  createClerkClientMock.mockReset();
  getTokenMock.mockReset();
});

afterEach(() => {
  // Re-import for each test so the cached `clerkPromise` singleton resets.
  vi.resetModules();
});

async function loadAuth(): Promise<typeof AuthModule> {
  return import('../src/lib/auth.js');
}

describe('getAuthToken', () => {
  it('returns the Clerk session token when a session is active', async () => {
    getTokenMock.mockResolvedValueOnce('eyJ-test-token');
    createClerkClientMock.mockResolvedValueOnce({ session: { getToken: getTokenMock } });

    const { getAuthToken } = await loadAuth();
    await expect(getAuthToken()).resolves.toBe('eyJ-test-token');
    expect(createClerkClientMock).toHaveBeenCalledWith(
      expect.objectContaining({ background: true }),
    );
  });

  it('returns null when no session is active', async () => {
    createClerkClientMock.mockResolvedValueOnce({ session: null });

    const { getAuthToken } = await loadAuth();
    await expect(getAuthToken()).resolves.toBeNull();
  });

  it('returns null when getToken resolves to null (token not yet refreshed)', async () => {
    getTokenMock.mockResolvedValueOnce(null);
    createClerkClientMock.mockResolvedValueOnce({ session: { getToken: getTokenMock } });

    const { getAuthToken } = await loadAuth();
    await expect(getAuthToken()).resolves.toBeNull();
  });

  it('swallows SDK errors and returns null so the sync loop survives', async () => {
    createClerkClientMock.mockRejectedValueOnce(new Error('boom'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { getAuthToken } = await loadAuth();
    await expect(getAuthToken()).resolves.toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('memoizes the Clerk client across calls in the same module instance', async () => {
    getTokenMock.mockResolvedValue('cached-token');
    createClerkClientMock.mockResolvedValue({ session: { getToken: getTokenMock } });

    const { getAuthToken } = await loadAuth();
    await getAuthToken();
    await getAuthToken();
    await getAuthToken();

    expect(createClerkClientMock).toHaveBeenCalledTimes(1);
    expect(getTokenMock).toHaveBeenCalledTimes(3);
  });
});
