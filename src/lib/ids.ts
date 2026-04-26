/**
 * UUIDv7 for capture idempotency keys. Time-ordered, server-friendly.
 *
 * The browser exposes `crypto.randomUUID()` which returns v4. We assemble a v7
 * manually so the runtime version doesn't matter. Same implementation as the
 * API's `lib/ids.ts`.
 *
 * Layout (32 hex chars, 5 groups):
 *   tttttttt-tttt-7xxx-yxxx-xxxxxxxxxxxx
 *     8        4    4    4        12
 *
 * Where t = ms timestamp, 7 = version, y = variant (8/9/a/b), x = random.
 *
 * We consume `rand` (20 hex chars from crypto.randomUUID) like so:
 *   rand[0]      → variant nibble (forced into 8/9/a/b)
 *   rand[1..3]   → 3 random nibbles after the version `7`
 *   rand[4..6]   → 3 random nibbles after the variant
 *   rand[7..18]  → 12 random nibbles in the final group
 *   (rand[19] is unused; we have one extra hex char to spare)
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
    `${variant}${rand.slice(4, 7)}`,
    rand.slice(7, 19),
  ].join('-');
}
