import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { answer, answerStream, type RagDeps } from "./core/rag";
import { ingest, type SiteDocument } from "./core/ingest";
import { ClaudeChatModel, VectorizeStore, WorkersAiEmbeddings } from "./providers/cloudflare";
import { WIDGET_JS } from "./widget/widget";
import { DEMO_HTML } from "./demo/page";

interface Env {
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  ANTHROPIC_API_KEY: string;
}

function cloudflareDeps(env: Env): RagDeps {
  return {
    embeddings: new WorkersAiEmbeddings(env.AI),
    store: new VectorizeStore(env.VECTORIZE),
    chat: new ClaudeChatModel(env.ANTHROPIC_API_KEY),
  };
}

// App factory: the deps builder is injected so tests run the real routes against the
// in-memory fakes — the SSE endpoint is proven offline, not just at deploy.
export function createApp(makeDeps: (env: Env) => RagDeps) {
  const app = new Hono<{ Bindings: Env }>();

  // Index site content.
  app.post("/ingest", async (c) => {
    const body = await c.req.json<{ docs?: SiteDocument[] }>();
    const indexed = await ingest(body.docs ?? [], makeDeps(c.env));
    return c.json({ indexed });
  });

  // Ask a grounded question. Default: JSON { answered, text, citations, topScore }.
  // With { stream: true }: SSE — `meta` first (gate verdict + citations), then `delta`s, then `done`.
  app.post("/chat", async (c) => {
    const body = await c.req.json<{ question?: string; stream?: boolean }>();
    const deps = makeDeps(c.env);

    if (body.stream === true) {
      return streamSSE(c, async (stream) => {
        for await (const event of answerStream(body.question ?? "", deps)) {
          await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
        }
      });
    }

    const result = await answer(body.question ?? "", deps);
    return c.json(result);
  });

  app.get("/widget.js", (c) =>
    c.body(WIDGET_JS, 200, { "content-type": "application/javascript; charset=utf-8" }),
  );

  app.get("/", (c) => c.html(DEMO_HTML));

  return app;
}

export default createApp(cloudflareDeps);
