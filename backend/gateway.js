// BTL gateway client + the three AI operations.
// Planned exports: tagMessage(text), embed(text), reflect(evidence)
//
// ── Section 7 battery results (2026-07-03, ~19:00 Abuja) ──
// 1. Chat round-trip: OK on laguna-xs.2 ("pong"). Most models return 402
//    "workspace balance too low" — free credits not yet applied to the key;
//    asked in event Discord. No ":free" routes exist (400 no provider route).
// 2. /v1/embeddings: 404 (gateway_not_found; no embedding models in catalog).
//    CONFIRMED by organizers in Discord: embeddings route not enabled for the
//    event; chat/completions + responses are the supported paths.
//    → FALLBACK IS THE PLAN: cheap model groups related messages (batched
//    grouping call) for thread matching + commitment follow-through.
// 3. stream:true: OK — 42 chunks on laguna-xs.2. Real SSE is viable.
// 4. Models: ~300 listed via /v1/models. Credits landed ~19:30 Abuja; pair
//    chosen after head-to-head probes:
//    CHEAP  = gpt-4o-mini (3.6s, only candidate to tag topic correctly)
//    STRONG = gpt-5.1     (5s, best reflection quality; kimi 19s, gemini slow)
//    Notes: reasoning models (gpt-5-nano, laguna-m.1) return empty content on
//    small max_tokens — avoid for tagging. claude-* routes require /v1/messages,
//    not /v1/chat/completions. Pre-credit fallback pair that also works:
//    laguna-xs.2 / laguna-m.1.
// 5. usage field: PRESENT (prompt/completion/total tokens) → real CostBar numbers.
//
// Model pair lives in .env (MODEL_CHEAP / MODEL_STRONG); swapping is a
// one-line edit. Embeddings 404 re-confirmed after credits → fallback stands.

import OpenAI from "openai";

export const client = new OpenAI({
  baseURL: process.env.BTL_BASE_URL,
  apiKey: process.env.BTL_API_KEY,
});
