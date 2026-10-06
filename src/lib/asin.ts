/** Amazon ASINs are 10 chars: B0-prefixed, or a 10-digit ISBN. */
const ASIN_RE = /^(B0[A-Z0-9]{8}|[0-9]{9}[0-9X])$/;

export function isAsin(value: unknown): value is string {
  return typeof value === 'string' && ASIN_RE.test(value);
}

/**
 * Keepa product links are `#!product/<domainId>-<ASIN>` — the finder's title
 * and flag cells both carry one, so a row click can be traced to an ASIN
 * without reaching into ag-Grid's row model.
 */
export function asinFromKeepaHref(href: string | null | undefined): string | null {
  if (!href) return null;
  const match = /#!product\/\d+-([A-Z0-9]{10})/.exec(href);
  const asin = match?.[1];
  return isAsin(asin) ? asin : null;
}
