import type { ChatModel, Embeddings, RetrievedChunk, VectorRecord, VectorStore } from "../core/types";

// Production providers. Not exercised by the offline test suite; verified at deploy (needs a
// Cloudflare account = the owner's budget gate). The core RAG logic is identical either way.

// Cloudflare Workers AI text embeddings (bge). `env.AI` is the Workers AI binding.
export class WorkersAiEmbeddings implements Embeddings {
  constructor(private readonly ai: Ai) {}

  async embed(texts: string[]): Promise<number[][]> {
    // `run` is heavily overloaded; cast at the platform boundary keeps the core types clean.
    const res = (await (this.ai as unknown as {
      run(model: string, inputs: { text: string[] }): Promise<{ data: number[][] }>;
    }).run("@cf/baai/bge-base-en-v1.5", { text: texts }));
    return res.data;
  }
}

// Cloudflare Vectorize as the vector store.
export class VectorizeStore implements VectorStore {
  constructor(private readonly index: VectorizeIndex) {}

  async upsert(records: VectorRecord[]): Promise<void> {
    await this.index.upsert(
      records.map((r) => ({ id: r.id, values: r.vector, metadata: { text: r.text, source: r.source } })),
    );
  }

  async query(vector: number[], topK: number): Promise<RetrievedChunk[]> {
    const res = await this.index.query(vector, { topK, returnMetadata: "all" });
    return res.matches.map((m) => ({
      text: String(m.metadata?.text ?? ""),
      source: String(m.metadata?.source ?? ""),
      score: m.score,
    }));
  }
}

// Claude (Haiku) via the Anthropic Messages API. Cheap model for grounded answers; the
// groundedness eval judge can use a stronger model. Call via fetch to keep the Worker dep-free.
export class ClaudeChatModel implements ChatModel {
  constructor(
    private readonly apiKey: string,
    private readonly model = "claude-haiku-4-5",
    private readonly baseUrl = "https://api.anthropic.com",
  ) {}

  async complete(system: string, user: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    return data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
  }

  // Streaming over the Messages API SSE: yield the text of every content_block_delta.
  // Like complete(), not exercised offline — the contract is proven against the local fake.
  async *stream(system: string, user: string): AsyncIterable<string> {
    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: user }],
        stream: true,
      }),
    });
    if (!res.ok || !res.body) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE frames are newline-delimited; a frame may split across chunks, so keep the tail.
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice("data: ".length).trim();
        if (payload === "" || payload === "[DONE]") continue;
        const event = JSON.parse(payload) as {
          type: string;
          delta?: { type: string; text?: string };
        };
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          yield event.delta.text ?? "";
        }
      }
    }
  }
}
