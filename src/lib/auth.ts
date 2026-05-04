import { createClerkClient } from '@clerk/chrome-extension/client';

import { env } from './env.js';

// Clerk's chrome-extension client doesn't ship its own TypeScript types for the
// resolved client instance, so we define just the surface we actually use.
interface ClerkSession {
  getToken(): Promise<string | null>;
}

interface ClerkInstance {
  session: ClerkSession | null | undefined;
}

let clerkPromise: Promise<ClerkInstance> | undefined;

function getClerk(): Promise<ClerkInstance> {
  clerkPromise ??= createClerkClient({
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
    syncHost: env.CLERK_SYNC_HOST,
    background: true,
  });
  return clerkPromise;
}

/**
 * Resolves the authentication token for background requests.
 *
 * Returns `null` when:
 *  - The user is not signed in (no active Clerk session).
 *  - The `syncHost` session has not yet propagated to the extension.
 *  - Any unexpected error from the Clerk SDK.
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    const clerk = await getClerk();
    return (await clerk.session?.getToken()) ?? null;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to get Clerk session token:', error);
    return null;
  }
}
