import { describe, it, expect, beforeAll } from "vitest";
import { EchoChatModel, HashEmbeddings, MemoryVectorStore } from "../src/providers/local";
import { ingest } from "../src/core/ingest";
import { answer, type RagDeps } from "../src/core/rag";

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

let deps: RagDeps;

beforeAll(async () => {
  const embeddings = new HashEmbeddings();
  const store = new MemoryVectorStore();
  const n = await ingest(CORPUS, { embeddings, store });
  expect(n).toBeGreaterThan(0);
  deps = { embeddings, store, chat: new EchoChatModel() };
});

describe("RAG answer with refusal gate", () => {
  it("answers an on-topic question and cites the right source", async () => {
    const r = await answer("return policy refund 30 days order number", deps);
    expect(r.answered).toBe(true);
    expect(r.topScore).toBeGreaterThan(0.35);
    expect(r.citations.length).toBeGreaterThan(0);
    expect(r.citations[0].source).toBe("returns");
    expect(r.text).toContain("[1]");
  });

  it("refuses an off-topic question instead of hallucinating", async () => {
    const r = await answer("airspeed velocity unladen swallow coconut migration", deps);
    expect(r.answered).toBe(false);
    expect(r.citations).toHaveLength(0);
    expect(r.text).toMatch(/don't know/i);
  });
});
