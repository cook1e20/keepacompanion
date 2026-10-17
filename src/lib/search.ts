const MAX_WORDS = 12;

function clean(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Brand + title query for a manual web search. Amazon titles are padded with
 * pipe-separated keyword runs and long feature lists, so the title is cut at
 * the first pipe and capped at the first 12 words. The brand is dropped when
 * the title already starts with it; a missing brand falls back to title only.
 */
export function buildSearchQuery(
  brand: string | null | undefined,
  title: string | null | undefined,
): string {
  const head = clean((title ?? '').split('|')[0]);
  const words = head ? head.split(' ').slice(0, MAX_WORDS) : [];
  const trimmedTitle = words.join(' ');
  const cleanBrand = clean(brand);

  if (!cleanBrand) return trimmedTitle;
  if (!trimmedTitle) return cleanBrand;

  const lowerTitle = trimmedTitle.toLowerCase();
  const lowerBrand = cleanBrand.toLowerCase();
  const startsWithBrand =
    lowerTitle === lowerBrand ||
    (lowerTitle.startsWith(lowerBrand) && /\s/.test(lowerTitle.charAt(lowerBrand.length)));
  return startsWithBrand ? trimmedTitle : `${cleanBrand} ${trimmedTitle}`;
}

/** UK Google search URL, or null when there is nothing to search for. */
export function googleSearchUrl(
  brand: string | null | undefined,
  title: string | null | undefined,
): string | null {
  const query = buildSearchQuery(brand, title);
  if (!query) return null;
  return `https://www.google.co.uk/search?q=${encodeURIComponent(query)}&gl=uk`;
}
