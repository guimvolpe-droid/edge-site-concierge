import type { ChatModel, Embeddings, VectorStore } from "./types";

export interface RagOptions {
  topK: number;
  refusalThreshold: number; // if the best retrieval score is below this, refuse instead of answering
}

export const DEFAULT_RAG: RagOptions = { topK: 4, refusalThreshold: 0.35 };

export interface Citation {
  n: number;
  source: string;
  score: number;
}

export interface AnswerResult {
  answered: boolean; // false => refused ("I don't know")
  text: string;
  citations: Citation[];
  topScore: number;
}

export const REFUSAL_TEXT = "I don't know based on this site's content.";

export const GROUNDING_SYSTEM = [
  "You are a website assistant. Answer ONLY using the provided context passages.",
  "Cite the passages you use inline as [n].",
  `If the answer is not contained in the context, reply exactly: "${REFUSAL_TEXT}"`,
  "Never use outside knowledge and never guess.",
].join(" ");

export interface RagDeps {
  embeddings: Embeddings;
  store: VectorStore;
  chat: ChatModel;
}

// The anti-hallucination gate lives BEFORE the model: if retrieval is too weak we refuse
// deterministically, which separates an honest "I don't know" from a made-up answer.
export async function answer(
  question: string,
  deps: RagDeps,
  opts: RagOptions = DEFAULT_RAG,
): Promise<AnswerResult> {
  const q = question.trim();
  const [qv] = await deps.embeddings.embed([q]);
  const hits = await deps.store.query(qv, opts.topK);
  const topScore = hits[0]?.score ?? 0;

  if (hits.length === 0 || topScore < opts.refusalThreshold) {
    return { answered: false, text: REFUSAL_TEXT, citations: [], topScore };
  }

  const context = hits.map((h, i) => `[${i + 1}] (${h.source})\n${h.text}`).join("\n\n");
  const user = `Context:\n${context}\n\nQuestion: ${q}`;
  const text = (await deps.chat.complete(GROUNDING_SYSTEM, user)).trim();

  const citations: Citation[] = hits.map((h, i) => ({ n: i + 1, source: h.source, score: h.score }));
  return { answered: true, text, citations, topScore };
}

// Streaming variant. The gate still decides BEFORE the model: `meta` is always the first
// event, carrying the verdict and citations; a refusal emits meta + done and never touches
// the model. Deltas concatenated equal answer().text for the same inputs.
export type StreamEvent =
  | { type: "meta"; answered: boolean; citations: Citation[]; topScore: number }
  | { type: "delta"; text: string }
  | { type: "done" };

export async function* answerStream(
  question: string,
  deps: RagDeps,
  opts: RagOptions = DEFAULT_RAG,
): AsyncGenerator<StreamEvent> {
  const q = question.trim();
  const [qv] = await deps.embeddings.embed([q]);
  const hits = await deps.store.query(qv, opts.topK);
  const topScore = hits[0]?.score ?? 0;

  if (hits.length === 0 || topScore < opts.refusalThreshold) {
    yield { type: "meta", answered: false, citations: [], topScore };
    yield { type: "delta", text: REFUSAL_TEXT };
    yield { type: "done" };
    return;
  }

  const citations: Citation[] = hits.map((h, i) => ({ n: i + 1, source: h.source, score: h.score }));
  yield { type: "meta", answered: true, citations, topScore };

  const context = hits.map((h, i) => `[${i + 1}] (${h.source})\n${h.text}`).join("\n\n");
  const user = `Context:\n${context}\n\nQuestion: ${q}`;
  for await (const delta of deps.chat.stream(GROUNDING_SYSTEM, user)) {
    yield { type: "delta", text: delta };
  }
  yield { type: "done" };
}
