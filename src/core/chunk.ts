import type { Chunk } from "./types";

export interface ChunkOptions {
  maxChars: number; // target chunk size
  overlap: number; // characters shared between consecutive chunks
}

export const DEFAULT_CHUNK: ChunkOptions = { maxChars: 800, overlap: 120 };

// Split a document's plain text into overlapping chunks, preferring paragraph/sentence boundaries.
export function chunkText(text: string, source: string, opts: ChunkOptions = DEFAULT_CHUNK): Chunk[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!clean) return [];

  const { maxChars, overlap } = opts;
  const chunks: Chunk[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + maxChars, clean.length);

    if (end < clean.length) {
      const slice = clean.slice(start, end);
      const para = slice.lastIndexOf("\n\n");
      const sentence = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("\n"));
      const breakAt = para > maxChars * 0.5 ? para : sentence > maxChars * 0.5 ? sentence + 1 : -1;
      if (breakAt > 0) end = start + breakAt;
    }

    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push({ text: piece, source });
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}
