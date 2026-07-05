import { Hono } from "hono";
import { answer, type RagDeps } from "./core/rag";
import { ingest, type SiteDocument } from "./core/ingest";
import { ClaudeChatModel, VectorizeStore, WorkersAiEmbeddings } from "./providers/cloudflare";
import { WIDGET_JS } from "./widget/widget";
import { DEMO_HTML } from "./demo/page";

interface Env {
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  ANTHROPIC_API_KEY: string;
}

function makeDeps(env: Env): RagDeps {
  return {
    embeddings: new WorkersAiEmbeddings(env.AI),
    store: new VectorizeStore(env.VECTORIZE),
    chat: new ClaudeChatModel(env.ANTHROPIC_API_KEY),
  };
}

const app = new Hono<{ Bindings: Env }>();

// Index site content.
app.post("/ingest", async (c) => {
  const body = await c.req.json<{ docs?: SiteDocument[] }>();
  const indexed = await ingest(body.docs ?? [], makeDeps(c.env));
  return c.json({ indexed });
});

// Ask a grounded question. Returns { answered, text, citations, topScore }.
app.post("/chat", async (c) => {
  const body = await c.req.json<{ question?: string }>();
  const result = await answer(body.question ?? "", makeDeps(c.env));
  return c.json(result);
});

app.get("/widget.js", (c) =>
  c.body(WIDGET_JS, 200, { "content-type": "application/javascript; charset=utf-8" }),
);

app.get("/", (c) => c.html(DEMO_HTML));

export default app;
