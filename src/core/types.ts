// Provider-agnostic contracts. The core RAG logic depends only on these, so it can be
// tested offline with in-memory fakes and run in production on Cloudflare + Claude.

export interface Embeddings {
  embed(texts: string[]): Promise<number[][]>;
}

export interface VectorRecord {
  id: string;
  vector: number[];
  text: string;
  source: string;
}

export interface RetrievedChunk {
  text: string;
  source: string;
  score: number; // cosine similarity, higher = closer
}

export interface VectorStore {
  upsert(records: VectorRecord[]): Promise<void>;
  query(vector: number[], topK: number): Promise<RetrievedChunk[]>;
}

export interface ChatModel {
  // Must answer only from the provided context; no outside knowledge.
  complete(system: string, user: string): Promise<string>;
  // Same contract as complete(), delivered as text deltas. Both implementations must
  // stream, so the streaming path is testable offline with the local fake.
  stream(system: string, user: string): AsyncIterable<string>;
}

export interface Chunk {
  text: string;
  source: string;
}
