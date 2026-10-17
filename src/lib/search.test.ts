import { describe, expect, it } from 'vitest';
import { buildSearchQuery, googleSearchUrl } from './search.js';

describe('buildSearchQuery', () => {
  it('joins brand and title', () => {
    expect(buildSearchQuery('Acme', 'Widget Pro 3000')).toBe('Acme Widget Pro 3000');
  });

  it('leaves the brand out when the title already starts with it (case-insensitive)', () => {
    expect(buildSearchQuery('acme', 'ACME Widget Pro')).toBe('ACME Widget Pro');
  });

  it('does not treat a longer first word as the brand', () => {
    expect(buildSearchQuery('Acme', 'Acmeware Widget')).toBe('Acme Acmeware Widget');
  });

  it('falls back to the title when brand is missing or blank', () => {
    expect(buildSearchQuery(undefined, 'Widget Pro')).toBe('Widget Pro');
    expect(buildSearchQuery(null, 'Widget Pro')).toBe('Widget Pro');
    expect(buildSearchQuery('  ', 'Widget Pro')).toBe('Widget Pro');
  });

  it('cuts Amazon padding after the first pipe', () => {
    expect(buildSearchQuery('Acme', 'Widget Pro | Fast | Durable | Gift')).toBe('Acme Widget Pro');
  });

  it('trims long titles to the first 12 words', () => {
    const title = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen';
    expect(buildSearchQuery(undefined, title)).toBe(
      'one two three four five six seven eight nine ten eleven twelve',
    );
  });

  it('collapses whitespace', () => {
    expect(buildSearchQuery('Acme', '  Widget \n  Pro ')).toBe('Acme Widget Pro');
  });

  it('returns empty when there is no title and no brand', () => {
    expect(buildSearchQuery(undefined, undefined)).toBe('');
    expect(buildSearchQuery('', '')).toBe('');
  });

  it('uses the brand alone when the title is missing', () => {
    expect(buildSearchQuery('Acme', undefined)).toBe('Acme');
  });
});

describe('googleSearchUrl', () => {
  it('targets google.co.uk with gl=uk and an encoded query', () => {
    const url = new URL(googleSearchUrl('Acme', 'Widget & Co 50% off')!);
    expect(url.origin).toBe('https://www.google.co.uk');
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('gl')).toBe('uk');
    expect(url.searchParams.get('q')).toBe('Acme Widget & Co 50% off');
  });

  it('returns null when there is nothing to search for', () => {
    expect(googleSearchUrl(undefined, undefined)).toBeNull();
  });
});
