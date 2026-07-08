import { parseSitemap } from "./sitemap";
import { htmlToText } from "./extract";
import type { SiteDocument } from "../core/ingest";

// Sitemap → pages → SiteDocument[] — pure orchestration over an injectable fetch, so the
// whole pipeline is testable offline with a fake. Runs locally (a Node script), not in the
// Worker: crawling is a batch job, not a request-time concern (see ADR 0003).

export interface CrawlOptions {
  fetchFn?: typeof fetch;
  maxPages?: number; // safety cap on pages fetched
  sameOriginOnly?: boolean; // ignore sitemap entries pointing off-origin
}

export interface CrawlResult {
  docs: SiteDocument[];
  skipped: string[]; // URLs not crawled (cap reached, off-origin, fetch/extract failures)
}

const DEFAULTS = { maxPages: 50, sameOriginOnly: true };

export async function crawlSite(sitemapUrl: string, opts: CrawlOptions = {}): Promise<CrawlResult> {
  const fetchFn = opts.fetchFn ?? fetch;
  const { maxPages, sameOriginOnly } = { ...DEFAULTS, ...opts };
  const origin = new URL(sitemapUrl).origin;

  // Resolve the page list; follow a <sitemapindex> one level down.
  const rootXml = await text(fetchFn, sitemapUrl);
  const root = parseSitemap(rootXml);
  let pageUrls: string[] = [];
  if (root.kind === "sitemapindex") {
    for (const child of root.urls) {
      const childParsed = parseSitemap(await text(fetchFn, child));
      pageUrls.push(...childParsed.urls);
    }
  } else {
    pageUrls = root.urls;
  }

  const docs: SiteDocument[] = [];
  const skipped: string[] = [];
  for (const url of pageUrls) {
    if (sameOriginOnly && new URL(url, origin).origin !== origin) {
      skipped.push(url);
      continue;
    }
    if (docs.length >= maxPages) {
      skipped.push(url);
      continue;
    }
    try {
      const { text: body } = htmlToText(await text(fetchFn, url));
      if (body.length > 0) docs.push({ source: url, text: body });
      else skipped.push(url);
    } catch {
      skipped.push(url);
    }
  }
  return { docs, skipped };
}

async function text(fetchFn: typeof fetch, url: string): Promise<string> {
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return await res.text();
}
