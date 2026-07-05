import { answer, type RagDeps, type RagOptions } from "./rag";

export interface GoldenCase {
  question: string;
  expectAnswered: boolean; // true = should answer from the corpus; false = should refuse
}

export interface EvalCase extends GoldenCase {
  gotAnswered: boolean;
  topScore: number;
  ok: boolean;
}

export interface EvalResult {
  total: number;
  correct: number;
  accuracy: number;
  cases: EvalCase[];
}

// Measures the refusal gate: does it answer when grounded and refuse when not?
export async function evaluate(
  golden: GoldenCase[],
  deps: RagDeps,
  opts?: RagOptions,
): Promise<EvalResult> {
  const cases: EvalCase[] = [];
  let correct = 0;

  for (const g of golden) {
    const r = await answer(g.question, deps, opts);
    const ok = r.answered === g.expectAnswered;
    if (ok) correct++;
    cases.push({ ...g, gotAnswered: r.answered, topScore: r.topScore, ok });
  }

  return {
    total: golden.length,
    correct,
    accuracy: golden.length ? correct / golden.length : 0,
    cases,
  };
}
