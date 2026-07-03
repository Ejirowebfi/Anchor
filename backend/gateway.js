// BTL gateway client + the three AI operations.
// Planned exports: tagMessage(text), embed(text), reflect(evidence)
//
// ── Section 7 battery results (2026-07-03, ~19:00 Abuja) ──
// 1. Chat round-trip: OK on laguna-xs.2 ("pong"). Most models return 402
//    "workspace balance too low" — free credits not yet applied to the key;
//    asked in event Discord. No ":free" routes exist (400 no provider route).
// 2. /v1/embeddings: 404 Not found → USE FALLBACK: cheap-model yes/no
//    similarity judging for thread matching.
// 3. stream:true: OK — 42 chunks on laguna-xs.2. Real SSE is viable.
// 4. Models: ~300 listed via /v1/models. Working pair chosen:
//    CHEAP  = laguna-xs.2 (small, fast — tagger)
//    STRONG = laguna-m.1  (reasoning model: hidden "reasoning" field, answer in
//             content; needs generous max_tokens or it returns empty — reflector)
//    claude-* routes require /v1/messages (native Anthropic), not
//    /v1/chat/completions — avoid unless needed.
// 5. usage field: PRESENT (prompt/completion/total tokens) → real CostBar numbers.
//
// Model pair lives in .env (MODEL_CHEAP / MODEL_STRONG) so upgrading after
// credits land is a one-line edit. (Re-checked 402s post-kickoff: still no
// credits on paid models; embeddings 404 across all known embed model names.)

import OpenAI from "openai";

export const client = new OpenAI({
  baseURL: process.env.BTL_BASE_URL,
  apiKey: process.env.BTL_API_KEY,
});
