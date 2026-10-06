import { describe, expect, it } from 'vitest';
import { formatAge, formatStamp, isTrackStatus, mergeRows, nextStatus } from './tracker.js';
import type { TrackerRow } from './types.js';

const NOW = new Date('2026-09-19T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe('nextStatus', () => {
  it('clears when the held status is clicked again', () => {
    expect(nextStatus('bought', 'bought')).toBeNull();
  });
  it('switches when a different status is clicked', () => {
    expect(nextStatus('bought', 'pass')).toBe('pass');
  });
  it('sets from empty', () => {
    expect(nextStatus(null, 'near_miss')).toBe('near_miss');
  });
});

describe('isTrackStatus', () => {
  it('accepts the four sanctioned statuses', () => {
    expect(['checked', 'bought', 'near_miss', 'pass'].every(isTrackStatus)).toBe(true);
  });
  it('rejects anything else', () => {
    expect(isTrackStatus('nearmiss')).toBe(false);
    expect(isTrackStatus(null)).toBe(false);
  });
});

describe('formatAge', () => {
  it('renders an em dash for never-searched', () => {
    expect(formatAge(null, NOW)).toBe('—');
    expect(formatAge('not-a-date', NOW)).toBe('—');
  });
  it('renders today for the same day and for clock skew', () => {
    expect(formatAge(daysAgo(0), NOW)).toBe('today');
    expect(formatAge(new Date(NOW.getTime() + 60_000).toISOString(), NOW)).toBe('today');
  });
  it('renders days below a fortnight', () => {
    expect(formatAge(daysAgo(3), NOW)).toBe('3d');
    expect(formatAge(daysAgo(13), NOW)).toBe('13d');
  });
  it('renders weeks from a fortnight to a year', () => {
    expect(formatAge(daysAgo(14), NOW)).toBe('2w');
    expect(formatAge(daysAgo(364), NOW)).toBe('52w');
  });
  it('renders years beyond a year', () => {
    expect(formatAge(daysAgo(365), NOW)).toBe('1y');
    expect(formatAge(daysAgo(3650), NOW)).toBe('10y');
  });
  it('never exceeds five characters, the width the column is sized for', () => {
    for (const d of [0, 1, 13, 14, 200, 364, 365, 3650, 36500]) {
      expect(formatAge(daysAgo(d), NOW).length).toBeLessThanOrEqual(5);
    }
  });
});

describe('formatStamp', () => {
  it('falls back for missing and unparseable values', () => {
    expect(formatStamp(null)).toBe('Never searched');
    expect(formatStamp('nope')).toBe('Never searched');
  });
  it('renders a real timestamp', () => {
    // en-GB abbreviates September as "Sept", not "Sep".
    expect(formatStamp('2026-09-19T12:00:00Z')).toMatch(/19 Sept 2026/);
  });
});

describe('mergeRows', () => {
  const base: TrackerRow = {
    asin: 'B017NVHSF8',
    status: 'checked',
    status_at: daysAgo(1),
    last_searched_at: daysAgo(1),
  };

  it('takes the incoming row when nothing is held', () => {
    expect(mergeRows(undefined, base)).toEqual(base);
  });

  it('keeps a newer local write over a stale server row', () => {
    const local: TrackerRow = { ...base, status: 'bought', status_at: daysAgo(0) };
    expect(mergeRows(local, base).status).toBe('bought');
  });

  it('accepts a newer server row', () => {
    const server: TrackerRow = { ...base, status: 'pass', status_at: daysAgo(0) };
    expect(mergeRows(base, server).status).toBe('pass');
  });

  it('merges the two timestamps independently', () => {
    const local: TrackerRow = { ...base, status: 'bought', status_at: daysAgo(0) };
    const server: TrackerRow = { ...base, last_searched_at: daysAgo(0) };
    const merged = mergeRows(local, server);
    expect(merged.status).toBe('bought');
    expect(merged.last_searched_at).toBe(daysAgo(0));
  });

  it('fills a null side from the incoming row', () => {
    const local: TrackerRow = { ...base, last_searched_at: null };
    expect(mergeRows(local, base).last_searched_at).toBe(base.last_searched_at);
  });
});
