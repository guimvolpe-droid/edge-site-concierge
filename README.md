# edge-site-concierge

**An embeddable AI concierge that answers *only* from a site's own content** — with citations, and an
honest *"I don't know"* when the answer isn't there. One `<script>` tag, running on the edge.

Built on **Cloudflare Workers** (Hono · Workers AI embeddings · Vectorize · streaming) with **Claude** for
grounded answers. The anti-hallucination guarantee is a **retrieval-score refusal gate** decided *before*
the model is ever called — see [`docs/adr/0001-refusal-gate.md`](docs/adr/0001-refusal-gate.md).

## Why

Most "chat with your site" widgets hallucinate the moment a question isn't covered by the content. This
one refuses honestly and cites its sources — the behaviour a buyer actually needs, proven with an eval
rather than promised.

## How it works

```
POST /ingest ─► chunk ─► embed (Workers AI bge) ─► Vectorize
POST /chat   ─► embed question ─► retrieve top-K ─► [refusal gate] ─► grounded answer + citations (Claude)
                                                        │
                                        score < threshold ⇒ "I don't know" (no model call)
```

The RAG core is **provider-agnostic** (`src/core`): it depends on `Embeddings` / `VectorStore` /
`ChatModel` interfaces. Production uses the Cloudflare + Claude providers (`src/providers/cloudflare.ts`);
the test suite uses in-memory fakes (`src/providers/local.ts`), so retrieval, grounding, the refusal gate,
and the eval are all verified **offline** — no account or API key required.

## Status

Honest, incremental build. What runs today vs. what's next:

| Area | Status |
|---|---|
| Provider-agnostic RAG core (chunk → embed → retrieve → grounded answer) | ✅ tested offline |
| Anti-hallucination **refusal gate** (retrieval-score threshold, before the model) | ✅ unit-tested |
| Groundedness **eval harness** (golden set: answers when grounded, refuses when not) | ✅ tested |
| Embeddable **widget** (1 script tag) + demo page | ✅ |
| Cloudflare **Worker** (Hono): `/ingest`, `/chat`, `/widget.js` | ✅ builds (`wrangler --dry-run`) |
| Cloudflare providers: Workers AI (bge) + Vectorize + Claude Haiku | ✅ typechecked · verified at deploy¹ |
| **SSE streaming** answers (gate-first `meta` event, incremental widget render) | ✅ tested offline ([ADR 0002](docs/adr/0002-sse-streaming.md)) |
| Sitemap / Playwright crawl ingestion | 🔜 next |
| Live deploy + eval dashboard + Loom | 🔜 next¹ |

¹ Deploy needs a Cloudflare account + `ANTHROPIC_API_KEY` (the project owner's budget gate). Every demo
uses synthetic data and surfaces real cost/latency and the cases where it refuses — anti-hype.

## Develop & verify (no account needed)

```bash
npm install
npm test         # RAG core, refusal gate, and groundedness eval — all offline
npm run typecheck
npx wrangler deploy --dry-run --outdir dist   # bundles the Worker + validates bindings
```

## Deploy (when the budget gate opens)

```bash
wrangler vectorize create site-concierge --dimensions=768 --metric=cosine
wrangler secret put ANTHROPIC_API_KEY
wrangler deploy
```

Then index content and ask:

```bash
curl -X POST https://<your-worker>/ingest -H 'content-type: application/json' -d @demo/corpus.json
curl -X POST https://<your-worker>/chat   -H 'content-type: application/json' \
  -d '{"question":"How long do I have to return an item?"}'
# → answers with a citation to /returns
curl -X POST https://<your-worker>/chat -H 'content-type: application/json' \
  -d '{"question":"What is your CEO'\''s home address?"}'
# → { "answered": false, "text": "I don't know based on this site's content." }
curl -N -X POST https://<your-worker>/chat -H 'content-type: application/json' \
  -d '{"question":"How long do I have to return an item?","stream":true}'
# → SSE: event `meta` (verdict + citations) first, then `delta` text fragments, then `done`
```

Or drop the widget into any page:

```html
<script>window.SC_ENDPOINT = 'https://<your-worker>';</script>
<script src="https://<your-worker>/widget.js"></script>
```

## License

[MIT](LICENSE) © 2026 Guilherme Volpe
