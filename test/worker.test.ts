import { describe, it, expect, beforeAll } from "vitest";
import { createApp } from "../src/worker";
import { EchoChatModel, HashEmbeddings, MemoryVectorStore } from "../src/providers/local";
import type { RagDeps } from "../src/core/rag";

// The real Hono routes exercised offline: createApp with the in-memory fakes, driven
// through app.request — this is the end-to-end proof of the SSE endpoint.

const CORPUS = [
  {
    source: "returns",
    text: "Our return policy allows a refund within 30 days of purchase. To start a return, email support with your order number.",
  },
  {
    source: "shipping",
    text: "We ship worldwide. Standard shipping takes five to seven business days. Express shipping is available at checkout.",
  },
];

// One shared deps instance so /ingest state is visible to /chat.
const deps: RagDeps = {
  embeddings: new HashEmbeddings(),
  store: new MemoryVectorStore(),
  chat: new EchoChatModel(),
};
const app = createApp(() => deps);

async function post(path: string, body: unknown): Promise<Response> {
  return await app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

interface SseFrame {
  event: string;
  data: { type: string; text?: string; answered?: boolean; citations?: { source: string }[] };
}

function parseSse(raw: string): SseFrame[] {
  const frames: SseFrame[] = [];
  let event = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice(7).trim();
    if (line.startsWith("data: ")) frames.push({ event, data: JSON.parse(line.slice(6)) });
  }
  return frames;
}

beforeAll(async () => {
  const res = await post("/ingest", { docs: CORPUS });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { indexed: number };
  expect(body.indexed).toBeGreaterThan(0);
});

describe("worker routes (offline, fakes)", () => {
  it("POST /chat without stream keeps the JSON contract", async () => {
    const res = await post("/chat", { question: "return policy refund 30 days order number" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as { answered: boolean; text: string };
    expect(body.answered).toBe(true);
    expect(body.text.length).toBeGreaterThan(0);
  });

  it("POST /chat with stream:true streams SSE — meta, deltas, done", async () => {
    const res = await post("/chat", {
      question: "return policy refund 30 days order number",
      stream: true,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const frames = parseSse(await res.text());
    expect(frames[0].event).toBe("meta");
    expect(frames[0].data.answered).toBe(true);
    expect(frames[0].data.citations?.[0]?.source).toBe("returns");
    expect(frames[frames.length - 1].event).toBe("done");

    const deltas = frames.filter((f) => f.event === "delta");
    expect(deltas.length).toBeGreaterThan(1);
    const text = deltas.map((f) => f.data.text ?? "").join("");
    expect(text).toContain("[1]");
  });

  it("streamed refusal sends meta{answered:false} and the refusal text", async () => {
    const res = await post("/chat", {
      question: "airspeed velocity unladen swallow coconut migration",
      stream: true,
    });
    const frames = parseSse(await res.text());
    expect(frames[0].event).toBe("meta");
    expect(frames[0].data.answered).toBe(false);
    const deltas = frames.filter((f) => f.event === "delta");
    expect(deltas).toHaveLength(1);
    expect(deltas[0].data.text).toMatch(/don't know/i);
  });

  it("GET /widget.js serves the embeddable script", async () => {
    const res = await app.request("/widget.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
    expect(await res.text()).toContain("SC_ENDPOINT");
  });
});
