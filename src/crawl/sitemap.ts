// Sitemap parsing — pure, no I/O. Tolerant regex extraction rather than a full XML parser:
// sitemaps in the wild vary (namespaces, CDATA, whitespace) and we only need the <loc> values.

const LOC = /<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi;

// Returns the page URLs of a <urlset>, or the child sitemap URLs of a <sitemapindex>.
// Deduplicates while preserving order.
export function parseSitemap(xml: string): { kind: "urlset" | "sitemapindex"; urls: string[] } {
  const kind = /<sitemapindex[\s>]/i.test(xml) ? "sitemapindex" : "urlset";
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const m of xml.matchAll(LOC)) {
    const url = m[1].trim();
    if (url && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  return { kind, urls };
}
