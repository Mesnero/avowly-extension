import { z } from 'zod';

/**
 * Wire schemas. Anything that crosses a trust boundary (content → background,
 * background → API, IndexedDB rows, chrome.storage) is validated against one
 * of these.
 *
 * Keep these aligned with the API's Zod schemas — the OpenAPI codegen pipeline
 * (in avowly-platform) will eventually generate the request/response types
 * that we mirror here. For now this is the source of truth on the extension
 * side.
 */

export const PlatformId = z.enum(['chatgpt', 'claude', 'gemini', 'perplexity']);
export type PlatformId = z.infer<typeof PlatformId>;

/**
 * What an adapter emits when a user submits a prompt. The background service
 * worker validates this before queuing.
 */
export const CapturedPrompt = z.object({
  /** Client-generated UUIDv7 — server uses it for idempotency. */
  id: z.string().uuid(),
  platform: PlatformId,
  /** Trimmed, normalized prompt text. */
  text: z.string().min(1).max(64_000),
  /** ms epoch from the page's clock. */
  capturedAt: z.number().int().positive(),
  /** Best-effort thread id from the page (may be undefined for new chats). */
  conversationId: z.string().optional(),
  /** Useful for debugging adapter regressions in the field. */
  extensionVersion: z.string(),
});
export type CapturedPrompt = z.infer<typeof CapturedPrompt>;

/**
 * Background ↔ content / popup messaging envelope. The discriminated union
 * keeps the type system honest and makes routing simple.
 */
export const ExtensionMessage = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('capture/prompt'), prompt: CapturedPrompt }),
  z.object({ kind: z.literal('capture/error'), platform: PlatformId, reason: z.string() }),
  z.object({ kind: z.literal('queue/status') }),
  z.object({ kind: z.literal('settings/get') }),
  z.object({
    kind: z.literal('settings/set'),
    settings: z.object({
      paused: z.boolean(),
      perPlatformEnabled: z.record(PlatformId, z.boolean()),
    }),
  }),
]);
export type ExtensionMessage = z.infer<typeof ExtensionMessage>;
