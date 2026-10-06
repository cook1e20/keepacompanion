import { describe, expect, it } from 'vitest';
import { badgeFor, chunk, isFresh, partitionAsins } from './gating.js';
import type { GatingRow } from './types.js';

const NOW = new Date('2026-09-19T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const row = (over: Partial<GatingRow> = {}): GatingRow => ({
  asin: 'B017NVHSF8', gated: false, reason_code: null, checked_at: daysAgo(1), ...over,
});

describe('isFresh', () => {
  it('trusts a recent completed check', () => {
    expect(isFresh(row(), NOW, 30)).toBe(true);
  });
  it('expires a check past the ttl', () => {
    expect(isFresh(row({ checked_at: daysAgo(31) }), NOW, 30)).toBe(false);
  });
  it('never trusts a failed check, however recent', () => {
    expect(isFresh(row({ gated: null, checked_at: daysAgo(0) }), NOW, 30)).toBe(false);
  });
  it('handles a missing row and an unparseable timestamp', () => {
    expect(isFresh(undefined, NOW, 30)).toBe(false);
    expect(isFresh(row({ checked_at: 'nope' }), NOW, 30)).toBe(false);
  });
});

describe('partitionAsins', () => {
  it('splits cached from stale', () => {
    const cache = new Map([['A', row({ asin: 'A' })], ['B', row({ asin: 'B', checked_at: daysAgo(99) })]]);
    const out = partitionAsins(['A', 'B', 'C'], cache, new Set(), NOW, 30);
    expect(out.cached).toEqual(['A']);
    expect(out.stale).toEqual(['B', 'C']);
  });

  it('does not re-request an asin already in flight', () => {
    const out = partitionAsins(['A', 'B'], new Map(), new Set(['A']), NOW, 30);
    expect(out.stale).toEqual(['B']);
  });

  it('de-duplicates repeats within one viewport', () => {
    const out = partitionAsins(['A', 'A', 'A'], new Map(), new Set(), NOW, 30);
    expect(out.stale).toEqual(['A']);
  });

  it('retries a failed check rather than treating it as cached', () => {
    const cache = new Map([['A', row({ asin: 'A', gated: null, checked_at: daysAgo(0) })]]);
    const out = partitionAsins(['A'], cache, new Set(), NOW, 30);
    expect(out.stale).toEqual(['A']);
  });
});

describe('badgeFor', () => {
  it('marks an unchecked asin', () => {
    expect(badgeFor(undefined).text).toBe('·');
  });
  it('marks gated, ungated and errored distinctly', () => {
    expect(badgeFor(row({ gated: true, reason_code: 'APPROVAL_REQUIRED' })).text).toBe('GATED');
    expect(badgeFor(row({ gated: false })).text).toBe('OK');
    expect(badgeFor(row({ gated: null })).text).toBe('?');
  });
  it('surfaces the reason code in the tooltip', () => {
    expect(badgeFor(row({ gated: true, reason_code: 'APPROVAL_REQUIRED' })).title)
      .toContain('APPROVAL_REQUIRED');
  });
});

describe('chunk', () => {
  it('splits evenly and handles a remainder', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it('returns nothing for an empty list', () => {
    expect(chunk([], 10)).toEqual([]);
  });
  it('rejects a nonsense size', () => {
    expect(() => chunk([1], 0)).toThrow(RangeError);
  });
});
