import { describe, expect, it } from 'vitest';

import { uuidv7 } from '../src/lib/ids.js';

describe('uuidv7', () => {
  it('returns a string in canonical UUID form with version 7', () => {
    const id = uuidv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('has the expected hyphenated layout and group widths (8-4-4-4-12)', () => {
    const id = uuidv7();
    const groups = id.split('-');
    expect(groups).toHaveLength(5);
    expect(groups.map((g) => g.length)).toEqual([8, 4, 4, 4, 12]);
  });

  it('is monotonic enough that two adjacent calls sort by time', () => {
    const a = uuidv7();
    const b = uuidv7();
    expect(a.slice(0, 13).localeCompare(b.slice(0, 13))).toBeLessThanOrEqual(0);
  });

  it('produces unique IDs across many calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuidv7()));
    expect(ids.size).toBe(1000);
  });
});
