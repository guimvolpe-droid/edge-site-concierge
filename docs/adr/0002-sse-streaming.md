# ADR 0002 — SSE streaming with a gate-first `meta` event

Status: accepted · Date: 2026-07-08

## Context

A concierge that waits for the full model response feels slow; streaming is table stakes for chat
UX. But streaming must not weaken the refusal gate (ADR 0001): the decision to answer is made
*before* the model is called, and the client needs that verdict — plus the citations — regardless
of how the text arrives.

## Decision

`POST /chat` accepts `{ "stream": true }` and responds with **SSE over a plain `fetch` POST**
(not WebSocket): three event types, in a fixed order.

1. **`meta`** — always the *first* event: `{ answered, citations, topScore }`. It is emitted the
   moment the gate decides, before any model token. Citations therefore arrive *before* the text
   they support.
2. **`delta`** — text fragments. Concatenated deltas equal the non-streaming `answer().text` for
   the same inputs. A refusal sends the fixed refusal sentence as one delta — same rendering path
   for the client — but the model is **never called** (enforced by a test whose chat model throws
   if reached).
3. **`done`** — terminator.

The core exposes this as `answerStream()` (an async generator of typed events) beside `answer()`;
the Worker maps events to SSE frames with Hono's `streamSSE`. `ChatModel` gains a required
`stream()` method — required, not optional, so the **local fake streams too** and the whole
contract (ordering, reassembly, refusal) is provable offline via `app.request` against the real
routes. Without `stream: true`, `/chat` keeps the original JSON contract.

## Consequences

- The gate stays measurable and first: no token can arrive before the verdict (`meta` precedes all
  deltas by construction, not by convention).
- The widget renders incrementally with a buffered SSE line parser over `fetch` +
  `ReadableStream` — no client library, works wherever `fetch` works, and falls back to the JSON
  shape when the response isn't an event stream.
- `test/stream.test.ts` proves ordering, reassembly equality, and the never-call-the-model refusal;
  `test/worker.test.ts` proves the endpoint end-to-end offline.
- The Anthropic streaming parser (`content_block_delta` / `text_delta`) lives only in the
  Cloudflare provider and, like `complete()`, is verified at deploy — the *contract* it must
  satisfy is the one the fake already proves.

## Alternatives considered

- **WebSocket** — rejected: stateful connections buy nothing here (one request → one streamed
  response), and SSE over POST-fetch keeps the Worker stateless and the widget dependency-free.
- **Optional `stream()` on `ChatModel`** — rejected: an optional method would let the offline
  suite silently skip the streaming path; making it required forces the fake to prove the contract.
