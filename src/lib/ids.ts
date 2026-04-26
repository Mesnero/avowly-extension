/**
 * UUIDv7 for capture idempotency keys. Time-ordered, server-friendly.
 *
 * The browser exposes `crypto.randomUUID()` which returns v4. We assemble a v7
 * manually so the runtime version doesn't matter. Same implementation as the
 * API's `lib/ids.ts`.
 */
export function uuidv7(): string {
  const ts = BigInt(Date.now());
  const tsHex = ts.toString(16).padStart(12, '0');

  const tail = crypto.randomUUID().replace(/-/g, '');
  const rand = tail.slice(12);
  // crypto.randomUUID() always returns 32 hex chars after stripping '-', so
  // rand has 20 chars. The charAt fallback satisfies noUncheckedIndexedAccess
  // without a non-null assertion.
  const variantHex = rand.charAt(0) || '0';
  const variant = ((parseInt(variantHex, 16) & 0x3) | 0x8).toString(16);

  return [
    tsHex.slice(0, 8),
    tsHex.slice(8, 12),
    `7${rand.slice(1, 4)}`,
    `${variant}${rand.slice(5, 8)}`,
    rand.slice(8, 20),
  ].join('-');
}
