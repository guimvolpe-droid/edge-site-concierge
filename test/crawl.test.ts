import { describe, it, expect } from "vitest";
import { parseSitemap } from "../src/crawl/sitemap";
import { htmlToText } from "../src/crawl/extract";
import { crawlSite } from "../src/crawl/crawl";

// Offline end-to-end proof of the crawl pipeline: a fake fetch serving fixture
// sitemaps + HTML, driven through the real crawlSite orchestration.

const PAGE_A = `<!doctype html><html><head><title>Returns &amp; Refunds</title>
<script>window.analytics = "tracker junk";</script>
<style>.x { color: red }</style></head>
<body><nav>Home | Shop | About</nav>
<h1>Returns</h1><p>You can request a refund within 30 days of purchase.</p>
<footer>© 2026 Example Shop</footer></body></html>`;

const PAGE_B = `<html><body><header>Example Shop</header>
<p>We ship worldwide. Standard shipping takes five business days.</p></body></html>`;

const URLSET = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://shop.example/returns</loc></url>
  <url><loc> https://shop.example/shipping </loc></url>
  <url><loc>https://shop.example/returns</loc></url>
  <url><loc>https://evil.other/phish</loc></url>
</urlset>`;

const SITEMAPINDEX = `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://shop.example/sitemap-pages.xml</loc></sitemap>
</sitemapindex>`;

const SITE = new Map<string, string>([
  ["https://shop.example/sitemap.xml", URLSET],
  ["https://shop.example/sitemap-index.xml", SITEMAPINDEX],
  ["https://shop.example/sitemap-pages.xml", URLSET],
  ["https://shop.example/returns", PAGE_A],
  ["https://shop.example/shipping", PAGE_B],
]);

const fakeFetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  const body = SITE.get(url);
  return body === undefined ? new Response("not found", { status: 404 }) : new Response(body);
}) as typeof fetch;

describe("parseSitemap", () => {
  it("extracts, trims and dedupes <loc> URLs from a urlset", () => {
    const r = parseSitemap(URLSET);
    expect(r.kind).toBe("urlset");
    expect(r.urls).toEqual([
      "https://shop.example/returns",
      "https://shop.example/shipping",
      "https://evil.other/phish",
    ]);
  });

  it("recognizes a sitemapindex", () => {
    const r = parseSitemap(SITEMAPINDEX);
    expect(r.kind).toBe("sitemapindex");
    expect(r.urls).toEqual(["https://shop.example/sitemap-pages.xml"]);
  });
});

describe("htmlToText", () => {
  it("keeps the content, drops scripts/styles/nav/footer, decodes entities", () => {
    const { title, text } = htmlToText(PAGE_A);
    expect(title).toBe("Returns & Refunds");
    expect(text).toContain("refund within 30 days");
    expect(text).not.toContain("tracker junk");
    expect(text).not.toContain("color: red");
    expect(text).not.toContain("Home | Shop");
    expect(text).not.toContain("© 2026");
  });
});

describe("crawlSite (fake fetch, offline)", () => {
  it("crawls a urlset into SiteDocuments, skipping off-origin URLs", async () => {
    const { docs, skipped } = await crawlSite("https://shop.example/sitemap.xml", {
      fetchFn: fakeFetch,
    });
    expect(docs.map((d) => d.source)).toEqual([
      "https://shop.example/returns",
      "https://shop.example/shipping",
    ]);
    expect(docs[0].text).toContain("refund within 30 days");
    expect(skipped).toContain("https://evil.other/phish");
  });

  it("follows a sitemapindex one level down", async () => {
    const { docs } = await crawlSite("https://shop.example/sitemap-index.xml", {
      fetchFn: fakeFetch,
    });
    expect(docs).toHaveLength(2);
  });

  it("respects maxPages and reports the rest as skipped", async () => {
    const { docs, skipped } = await crawlSite("https://shop.example/sitemap.xml", {
      fetchFn: fakeFetch,
      maxPages: 1,
    });
    expect(docs).toHaveLength(1);
    expect(skipped).toContain("https://shop.example/shipping");
  });

  it("skips pages that fail to fetch instead of aborting the crawl", async () => {
    const broken = new Map(SITE);
    broken.delete("https://shop.example/returns");
    const fetchFn = (async (input: RequestInfo | URL) => {
      const body = broken.get(String(input));
      return body === undefined ? new Response("nope", { status: 500 }) : new Response(body);
    }) as typeof fetch;

    const { docs, skipped } = await crawlSite("https://shop.example/sitemap.xml", { fetchFn });
    expect(docs.map((d) => d.source)).toEqual(["https://shop.example/shipping"]);
    expect(skipped).toContain("https://shop.example/returns");
  });
});
