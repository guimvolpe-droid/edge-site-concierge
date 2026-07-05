# ADR 0001 — A retrieval-score refusal gate, decided before the model

Status: accepted · Date: 2026-07-05

## Context

A site chatbot that "answers from your content" fails in the worst way when the answer isn't in the
content: it makes something up. Asking the LLM to "say I don't know if unsure" helps but is not a
guarantee — the model still decides, and it sometimes decides wrong, confidently.

## Decision

The decision to answer is made **before** the model is called, from a measurable signal: the retrieval
score of the best-matching passage.

- Embed the question, retrieve the top-K passages, and read the best similarity score.
- If that score is below a configured `refusalThreshold` (or nothing was retrieved), return a fixed
  refusal — `"I don't know based on this site's content."` — and never call the model.
- Only above the threshold do we build a grounded prompt (context passages + a cite-your-sources system
  instruction) and ask the model, returning the answer **with citations**.

This separates two things a naïve chatbot conflates: an honest **"I don't know"** (weak retrieval) from a
**hallucination** (the model inventing an answer). "I don't know" becomes a deterministic, testable
property of the retrieval layer, not a hope about model behaviour.

## Consequences

- The anti-hallucination guarantee is unit-testable with no LLM in the loop (see `test/rag.test.ts`,
  `test/eval.test.ts`): off-topic questions refuse; on-topic questions answer and cite.
- The model is a second line of defense (its system prompt also instructs it to refuse and to cite), not
  the only one.
- The threshold is a tunable dial between coverage and safety, reported by the groundedness eval so it can
  be chosen with data rather than by feel.
- Cost drops too: below-threshold questions short-circuit before spending a model call.

## Alternatives considered

- **Prompt-only ("say I don't know if unsure")** — rejected as the sole mechanism: no measurable
  guarantee, and it still pays for a model call to refuse.
- **Always answer, post-hoc hallucination check** — rejected: more expensive and later than gating on the
  signal we already computed during retrieval.
