// Crawl a site's sitemap and feed the pages to a concierge /ingest endpoint (or a file).
//
//   npx tsx scripts/crawl.ts <sitemap-url> [--endpoint http://host/ingest] [--out demo/corpus.json]
//                            [--max N] [--dry-run]
//
// Runs locally on Node (not in the Worker) — see docs/adr/0003-crawl-as-local-script.md.

import { writeFileSync } from "node:fs";
import { crawlSite } from "../src/crawl/crawl";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const sitemapUrl = process.argv[2];
if (!sitemapUrl || sitemapUrl.startsWith("--")) {
  console.error("usage: npx tsx scripts/crawl.ts <sitemap-url> [--endpoint URL | --out FILE] [--max N] [--dry-run]");
  process.exit(2);
}

const endpoint = arg("--endpoint");
const out = arg("--out");
const max = Number(arg("--max") ?? 50);
const dryRun = process.argv.includes("--dry-run");

const { docs, skipped } = await crawlSite(sitemapUrl, { maxPages: max });
console.error(`crawled ${docs.length} page(s), skipped ${skipped.length}`);
for (const d of docs) console.error(`  ${d.source} (${d.text.length} chars)`);
if (skipped.length > 0) console.error(`  skipped: ${skipped.join(", ")}`);

if (dryRun) process.exit(0);

if (out) {
  writeFileSync(out, JSON.stringify(docs, null, 2));
  console.error(`wrote ${out}`);
} else if (endpoint) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ docs }),
  });
  if (!res.ok) throw new Error(`${endpoint}: HTTP ${res.status} ${await res.text()}`);
  console.error(`ingested: ${await res.text()}`);
} else {
  console.log(JSON.stringify(docs, null, 2));
}
