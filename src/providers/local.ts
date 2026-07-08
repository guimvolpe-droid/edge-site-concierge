import type { ChatModel, Embeddings, RetrievedChunk, VectorRecord, VectorStore } from "../core/types";

const DIM = 128;

// Deterministic bag-of-words hashed embedding. Overlapping vocabulary -> higher cosine
// similarity. Not semantic, but enough to exercise retrieval/ranking/refusal logic offline.
export class HashEmbeddings implements Embeddings {
  constructor(private readonly dim = DIM) {}

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.one(t));
  }

  private one(text: string): number[] {
    const v = new Array<number>(this.dim).fill(0);
    for (const tok of tokenize(text)) v[hash(tok) % this.dim] += 1;
    return normalize(v);
  }
}

// In-memory cosine store — the local stand-in for Cloudflare Vectorize.
export class MemoryVectorStore implements VectorStore {
  private records: VectorRecord[] = [];

  async upsert(records: VectorRecord[]): Promise<void> {
    for (const r of records) {
      const i = this.records.findIndex((x) => x.id === r.id);
      if (i >= 0) this.records[i] = r;
      else this.records.push(r);
    }
  }

  async query(vector: number[], topK: number): Promise<RetrievedChunk[]> {
    return this.records
      .map((r) => ({ text: r.text, source: r.source, score: cosine(vector, r.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  get size(): number {
    return this.records.length;
  }
}

// Deterministic stand-in for a grounded LLM: proves the pipeline wired context + citations.
// Real answers come from the Cloudflare/Claude provider.
export class EchoChatModel implements ChatModel {
  async complete(_system: string, user: string): Promise<string> {
    const m = user.match(/\[1\]\s*\([^)]*\)\n([^\n]+)/);
    const snippet = (m?.[1] ?? "").slice(0, 120);
    return `Based on the site content: ${snippet} [1]`.trim();
  }

  // Streams the exact same text complete() would return, one word at a time, so the
  // streaming contract (order, reassembly) is provable offline.
  async *stream(system: string, user: string): AsyncIterable<string> {
    const text = await this.complete(system, user);
    const words = text.split(" ");
    for (let i = 0; i < words.length; i++) {
      yield i === 0 ? words[i] : ` ${words[i]}`;
    }
  }
}

function tokenize(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

// Vectors are L2-normalized, so the dot product is the cosine similarity.
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
