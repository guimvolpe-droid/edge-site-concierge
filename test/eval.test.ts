import { describe, it, expect } from "vitest";
import { EchoChatModel, HashEmbeddings, MemoryVectorStore } from "../src/providers/local";
import { ingest } from "../src/core/ingest";
import { evaluate, type GoldenCase } from "../src/core/eval";
import type { RagDeps } from "../src/core/rag";

const CORPUS = [
  {
    source: "returns",
    text: "Our return policy allows a refund within 30 days of purchase. Email support with your order number to start a return.",
  },
  {
    source: "hours",
    text: "Our store is open Monday to Friday, nine to five. We are closed on public holidays.",
  },
];

const GOLDEN: GoldenCase[] = [
  { question: "return refund 30 days order number", expectAnswered: true },
  { question: "store open Monday Friday hours holidays", expectAnswered: true },
  { question: "quantum tunneling semiconductor lattice electron", expectAnswered: false },
];

describe("groundedness eval", () => {
  it("answers when grounded and refuses when not (100% on the golden set)", async () => {
    const embeddings = new HashEmbeddings();
    const store = new MemoryVectorStore();
    await ingest(CORPUS, { embeddings, store });
    const deps: RagDeps = { embeddings, store, chat: new EchoChatModel() };

    const res = await evaluate(GOLDEN, deps);
    expect(res.accuracy).toBe(1);
    expect(res.cases.every((c) => c.ok)).toBe(true);
  });
});
