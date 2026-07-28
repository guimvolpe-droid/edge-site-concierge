# edge-site-concierge — Regras do repo

Peça de portfólio do carreira-os (Cloudflare): concierge de IA embutível que responde **só com o
conteúdo do próprio site** — citações + "I don't know" honesto. Workers (Hono · Workers AI
embeddings · Vectorize · SSE) + Claude para resposta grounded. Garantia anti-alucinação =
**refusal gate por score de retrieval**, decidido ANTES de chamar o modelo
(`docs/adr/0001-refusal-gate.md`). Core RAG provider-agnostic (`src/core`); fakes em
`src/providers/local.ts` fazem retrieval, grounding, gate e eval rodarem **offline**.

## Comandos

- `npm test` (suíte offline, inclui eval de groundedness) · `npx wrangler dev` ·
  ingestão por sitemap: script local em `scripts/` (testado offline).

## Gates (só o dono decide)

- Deploy real na Cloudflare, chave de API paga, divulgação/uso em candidatura.
- Idioma do repo é EN (portfólio) — manter README/docs/commits deste repo em inglês.

## Artefatos: 3 destinos <!-- origem: ~/projects/CLAUDE.md · v1 · copiado 2026-07-28 -->

- Arquivo gerado (screenshot, dump, export, peça em rascunho) NUNCA na raiz: lixo → `descarte/`
  (gitignored, só o dono apaga) · reutilizável fora de uso → `bkp/AAAA-MM-<slug>/` (gitignored,
  indexado em `bkp/LEIA-ME.md`) · versão FINAL → caminho canônico, nome estável (sem -v2/-final).
- MDs de estado guardam SÓ estado final (sem "era X virou Y"); contradição = corrigir na hora.
