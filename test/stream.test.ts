import { describe, it, expect, beforeAll } from "vitest";
import { EchoChatModel, HashEmbeddings, MemoryVectorStore } from "../src/providers/local";
import { ingest } from "../src/core/ingest";
import { answer, answerStream, type RagDeps, type StreamEvent } from "../src/core/rag";
import type { ChatModel } from "../src/core/types";

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

// A chat model that must never be reached: proves the gate refuses BEFORE the model.
class ExplodingChatModel implements ChatModel {
  async complete(): Promise<string> {
    throw new Error("model must not be called on refusal");
  }
  // eslint-disable-next-line require-yield
  async *stream(): AsyncIterable<string> {
    throw new Error("model must not be called on refusal");
  }
}

let deps: RagDeps;

beforeAll(async () => {
  const embeddings = new HashEmbeddings();
  const store = new MemoryVectorStore();
  await ingest(CORPUS, { embeddings, store });
  deps = { embeddings, store, chat: new EchoChatModel() };
});

async function collect(question: string, d: RagDeps): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const e of answerStream(question, d)) events.push(e);
  return events;
}

describe("answerStream", () => {
  it("emits meta first, then deltas, then done — in that order", async () => {
    const events = await collect("return policy refund 30 days order number", deps);
    expect(events[0].type).toBe("meta");
    expect(events[events.length - 1].type).toBe("done");
    const middle = events.slice(1, -1);
    expect(middle.length).toBeGreaterThan(1);
    expect(middle.every((e) => e.type === "delta")).toBe(true);
  });

  it("meta carries the gate verdict and citations before any token", async () => {
    const events = await collect("return policy refund 30 days order number", deps);
    const meta = events[0];
    if (meta.type !== "meta") throw new Error("first event must be meta");
    expect(meta.answered).toBe(true);
    expect(meta.citations[0].source).toBe("returns");
    expect(meta.topScore).toBeGreaterThan(0.35);
  });

  it("concatenated deltas equal answer().text for the same inputs", async () => {
    const question = "return policy refund 30 days order number";
    const events = await collect(question, deps);
    const streamed = events
      .filter((e): e is Extract<StreamEvent, { type: "delta" }> => e.type === "delta")
      .map((e) => e.text)
      .join("");
    const single = await answer(question, deps);
    expect(streamed).toBe(single.text);
  });

  it("refuses off-topic questions without ever calling the model", async () => {
    const gated: RagDeps = { ...deps, chat: new ExplodingChatModel() };
    const events = await collect("airspeed velocity unladen swallow coconut migration", gated);
    const meta = events[0];
    if (meta.type !== "meta") throw new Error("first event must be meta");
    expect(meta.answered).toBe(false);
    expect(meta.citations).toHaveLength(0);
    const deltas = events.filter((e) => e.type === "delta");
    expect(deltas).toHaveLength(1); // the refusal text itself, not model output
    expect(events[events.length - 1].type).toBe("done");
  });
});
