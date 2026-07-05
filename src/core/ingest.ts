import { chunkText, type ChunkOptions } from "./chunk";
import type { Embeddings, VectorStore } from "./types";

export interface SiteDocument {
  source: string; // url or page id
  text: string;
}

// Chunk -> embed -> upsert. Returns how many chunks were indexed.
export async function ingest(
  docs: SiteDocument[],
  deps: { embeddings: Embeddings; store: VectorStore },
  opts?: ChunkOptions,
): Promise<number> {
  const chunks = docs.flatMap((d) => chunkText(d.text, d.source, opts));
  if (chunks.length === 0) return 0;

  const vectors = await deps.embeddings.embed(chunks.map((c) => c.text));
  const records = chunks.map((c, i) => ({
    id: `${c.source}#${i}`,
    vector: vectors[i],
    text: c.text,
    source: c.source,
  }));

  await deps.store.upsert(records);
  return records.length;
}
