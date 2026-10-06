import { describe, expect, it } from 'vitest';
import { asinFromKeepaHref, isAsin } from './asin.js';

describe('isAsin', () => {
  it('accepts B0 asins and 10-digit ISBNs', () => {
    expect(isAsin('B017NVHSF8')).toBe(true);
    expect(isAsin('014103614X')).toBe(true);
  });
  it('rejects the wrong shape', () => {
    expect(isAsin('B017NVHSF')).toBe(false);
    expect(isAsin('b017nvhsf8')).toBe(false);
    expect(isAsin(undefined)).toBe(false);
  });
});

describe('asinFromKeepaHref', () => {
  it('pulls the asin out of a keepa product link', () => {
    expect(asinFromKeepaHref('#!product/2-B017NVHSF8')).toBe('B017NVHSF8');
    expect(asinFromKeepaHref('https://keepa.com/#!product/2-B017NVHSF8')).toBe('B017NVHSF8');
  });
  it('ignores links that are not product links', () => {
    expect(asinFromKeepaHref('https://www.ebay.co.uk/sch/?kw=4060800130754')).toBeNull();
    expect(asinFromKeepaHref('#!finder')).toBeNull();
    expect(asinFromKeepaHref(null)).toBeNull();
  });
});
