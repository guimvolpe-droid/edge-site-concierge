# ADR 0003 — Sitemap crawl as a local script, not in the Worker, not Playwright

Status: accepted · Date: 2026-07-08

## Context

Real ingestion needs to come from a site's actual pages, not hand-written JSON. The obvious
candidates: crawl inside the Worker (an endpoint that fetches the site), or a heavyweight local
crawler driving a headless browser (Playwright).

## Decision

Crawling is a **local Node script** (`scripts/crawl.ts`, run with `tsx`) that reads a
`sitemap.xml`, extracts each page's text, and POSTs the documents to any `/ingest` endpoint —
local `wrangler dev` or a deployed Worker. The pipeline itself is **pure core code**
(`src/crawl/`): sitemap parsing, HTML→text extraction, and orchestration over an injectable
`fetch`, so the whole thing is tested offline with fixture pages and a fake fetch.

Why not in the Worker: crawling is a batch job, not a request-time concern. A Worker crawl
endpoint fights CPU-time and subrequest limits, turns one HTTP request into an unbounded fan-out,
and — decisive here — could only be verified against a deployed instance, which sits behind the
project's budget gate. The local script exercises the identical `/ingest` contract with none of
that.

Why not Playwright: a full browser is a heavy dependency for what is, on content sites (the
target buyer for a site concierge), static HTML. Fetch + tag-stripping extracts the text that
matters. **Known limitation, stated in the README:** pages rendered entirely by client-side
JavaScript yield little or no text; if that market segment matters later, a Playwright-based
extractor can slot in behind the same `SiteDocument[]` contract.

## Consequences

- `npm run crawl -- <sitemap-url> --dry-run` shows what would be ingested; `--endpoint` feeds a
  running concierge; `--out` snapshots a corpus file for demos.
- Sitemap indexes are followed one level; off-origin entries are skipped (`sameOriginOnly`) and a
  `maxPages` cap bounds the crawl. Skipped URLs are reported, not silently dropped.
- The scripts get their own `tsconfig` (Node types) so `npm run typecheck` covers CLI and Worker
  code with the right ambient types for each.
