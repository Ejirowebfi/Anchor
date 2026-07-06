# CLAUDE.md — Anchor v2: The Say–Do Mirror (Handoff Spec)

> **Instructions for Claude (Claude Code / VS Code):** This file is the complete, authoritative spec. It REPLACES any previous Anchor spec. Read it fully before writing code. The human (Favourejiro) is the product owner and makes all final calls — build one milestone at a time, verify each checkpoint by having them USE the app, remind them to commit after each win, and never add anything outside this spec without asking. Prefer the simpler option always.

---

## 1. Identity (this drives every decision)

**Anchor — the first app that tracks the gap between your words and your actions, and shows you the receipts.**

Pitch: *"Your journal knows what you said. Your tracker knows what you did. Anchor knows the difference."*

Tagline: *"It remembers what you're avoiding."*

You text it freely through the day. It quietly extracts the promises you make to yourself, watches whether your later words ever report follow-through, notices when you go silent on things that used to matter, and — on demand — delivers a reflection that is a kind, evidence-cited report on the gap between what you say and what you do.

**Anchor is NOT:** a chatbot (it doesn't converse), a therapist (mirror, not doctor — include the line "a thinking companion, not therapy" in the README), a habit tracker (users never configure habits; promises are detected from natural language), or a mood app.

## 2. The four pillars (all features map to one of these; anything that maps to none gets cut)

1. **Catch the words** — effortless capture + automatic tagging of every message (topic, mood, is-commitment).
2. **Watch the follow-through** — every detected promise stays open until the user's own later words close it (kept) or silence closes it (drifting). The Ledger is the scoreboard: **"Said 9 · Did 3."**
3. **Prove everything** — every claim in a reflection cites the exact source messages with dates. Receipts, always. Never vibes.
4. **Hear the silences** — threads that were active and went quiet get flagged: "Three weeks quiet on the startup idea. Dropped, or resolved?"

## 3. Hackathon context (deadlines are real)

- **BTL Runtime Hackathon** · submissions due **July 7, 15:00 UTC = 4:00 PM Abuja (user's timezone)**. Demo day 17:00 UTC, winners 20:00 UTC same day.
- **The one rule:** ALL LLM/embedding calls go through the **BTL runtime gateway** (OpenAI-compatible: `/v1/chat/completions`, `/v1/responses`, expected `/v1/embeddings`).
- **Models:** the event issues **5M DeepSeek starter tokens** per workspace. Expect the routing split to be **DeepSeek fast/chat model (cheap tier) vs DeepSeek reasoning model (strong tier)**. Verify actual model names in the workspace. In README/video say "cost-based model routing through the gateway" — only claim "multi-provider" if multiple providers are actually available.
- **Submission:** GitHub repo + 2-minute demo video. **$100 spot prize for "best use of the runtime"** is a primary target — the feature table in Section 11 is the argument.
- **Feature freeze: July 7, noon Abuja.** After that: video, README, submit by 3 PM (1-hour buffer).
- Commit after every working step, meaningful messages.

## 4. Working style (important)

- User is **vibe-coding**: Claude implements; the user steers, tests in the browser, owns judgment calls (thresholds, tone, cuts).
- One milestone at a time. After each: tell the user exactly how to verify by using the app, then remind them to commit.
- No scope creep. Section 12 is the out-of-scope list; Section 8 is the priority order when time runs short.

## 5. Stack (boring on purpose — do not upgrade)

- **Frontend:** React + Vite (JavaScript), one page.
- **Backend:** Node.js + Express (~300–400 lines).
- **Storage:** in-memory array + JSON file persistence (load on start, save on write). No database.
- **AI:** `openai` npm package pointed at the gateway:

```js
import OpenAI from "openai";
const client = new OpenAI({
  baseURL: process.env.BTL_BASE_URL,
  apiKey: process.env.BTL_API_KEY,
});
```

- **Streaming:** SSE (not WebSockets). If SSE fights for >90 min, fall back to fetch-full-then-reveal-word-by-word (visually identical).
- **Secrets:** `backend/.env`, gitignored from first commit. Never hardcode. Never commit.

### Repo layout

```
anchor/
├── README.md
├── CLAUDE.md                  # this file
├── backend/
│   ├── server.js              # routes: /ping, /message, /reflect (SSE), /ledger, /stats, /search (optional)
│   ├── gateway.js             # BTL client: tagMessage(), embed(), reflect(); model names in config
│   ├── prompts.js             # ALL prompt text lives here only
│   ├── store.js               # messages + JSON persistence
│   ├── patterns.js            # cosine sim, findThreads(), ledger logic, silence detection, evidence builder
│   ├── .env                   # BTL_BASE_URL, BTL_API_KEY (gitignored)
│   └── data.json              # persisted messages
└── frontend/
    └── src/
        ├── App.jsx            # layout: Ledger is the CENTERPIECE, not a side panel
        ├── ChatFeed.jsx       # input + feed with tag chips
        ├── Ledger.jsx         # the scoreboard: Said X · Did Y + per-commitment statuses
        ├── ReflectPanel.jsx   # Reflect button + streaming output + tappable citations
        └── CostBar.jsx        # cheap-vs-strong spend split
```

## 6. Data model

```js
// Message
{
  id: 17,
  text: "skipped the gym again, whatever",
  timestamp: "2026-07-06T09:12:00Z",
  tags: { topic: "health", mood: "resigned", is_commitment: false, commitment_text: null },
  embedding: [/* floats */],
  tokens_used: 84
}

// Commitment (derived, lives in ledger state)
{
  id: 3,
  text: "I'll start gym Monday",
  source_message_id: 5,
  made_at: "2026-06-20T...",
  status: "open" | "kept" | "drifting",   // drifting = no follow-through signal after DRIFT_DAYS (default 10; user-tunable)
  kept_evidence_message_id: null           // set when a later message reports follow-through
}

// Reflection output (structured — needed for citations)
{
  sections: [
    { claim: "You've committed to the gym 3 times in 16 days and never mentioned going.",
      evidence_ids: [5, 12, 19] },
    ...
  ],
  suggestion: "one small, concrete, evidence-grounded next step",
  question: "one genuine question",
  honesty_note: null | "evidence is thin this period — here's the little I can say"
}
```

## 7. The AI operations (all through the gateway)

### A. Tagger — cheap model, every message, temperature 0
JSON-only output, parsed in try/catch; on ANY failure default to `{topic:"general", mood:"neutral", is_commitment:false, commitment_text:null}`.

**Prompt (draft — user tunes):**
> You tag journal messages. Respond ONLY with JSON, no other text:
> `{"topic":"<one-two words>","mood":"<one word>","is_commitment":true/false,"commitment_text":"<the promise, or null>"}`
> A commitment is a stated intention ("I'll start Monday","gonna call mom this week"). Reporting that you DID something is NOT a commitment.

### B. Embeddings — every message
Fingerprint for thread-grouping and follow-through matching. **If `/v1/embeddings` is unavailable** (verify at start — Section 9): fall back to cheap-model yes/no similarity judgments.

### C. Ledger engine (`patterns.js`, mostly math + one cheap call)
- New commitment detected → open entry in ledger.
- Every new non-commitment message → check embedding similarity vs open commitments; if similar AND reads like follow-through, confirm with one cheap-model yes/no ("does this message report doing X?") → mark **kept**, store evidence id.
- Open commitments older than DRIFT_DAYS with no follow-through → **drifting**.
- Header math: Said = total commitments, Did = kept.

### D. Silence detection (`patterns.js`, pure math)
Threads with ≥3 messages whose last message is older than SILENCE_DAYS (default 14; user-tunable) → flagged as "gone quiet," fed to the evidence builder.

### E. Reflector — strong model, on demand only, streamed
Backend builds pre-chewed **evidence** first: top threads (texts + dates + message ids), ledger report, silence flags, mood tally, and the PREVIOUS reflection (for the delta). Never dump raw history.

**Prompt (draft — the product's soul; expect several tuning rounds):**
> You are Anchor, a companion who has been quietly paying attention. You receive evidence: recurring threads (messages with ids and dates), a commitment ledger (said vs did, with statuses), threads gone silent, mood counts, and the previous reflection if any. Write a reflection that is a kind, honest report on the gap between what this person says and what they do:
> - Name the most significant pattern with specifics: counts, dates, a short quoted phrase or two.
> - Address repeated unkept commitments directly but kindly — curious, not judgmental.
> - If a thread went silent, ask about it: dropped or resolved?
> - If a previous reflection is provided, note one thing that changed and one that didn't.
> - Offer ONE small, concrete, doable-this-week suggestion that grows directly out of the evidence (never generic advice).
> - End with one genuine question.
> - If evidence is thin, say so plainly instead of inventing depth.
> - Never diagnose, never use clinical language; if messages suggest real distress, gently suggest talking to someone they trust.
> Respond ONLY as JSON: {"sections":[{"claim":"...","evidence_ids":[...]}],"suggestion":"...","question":"...","honesty_note":null or "..."} — every claim MUST list the message ids it rests on. Max ~200 words of total prose.

Frontend renders sections as streamed text; each claim is tappable → shows the cited messages with dates (Pillar 3). If streaming structured JSON proves fiddly: stream to completion server-side, then reveal word-by-word client-side — acceptable.

## 8. Build order (strict priority — cut from the BOTTOM when time runs short)

**CORE (must exist):**
1. Scaffold + /ping round-trip (frontend↔backend talking)
2. Gateway wired + verification battery (Section 9)
3. Message pipeline: POST /message → tag → embed → store → chips in UI
4. Threads (cosine + grouping; user tunes threshold, start 0.80)
5. Ledger engine + **Ledger UI as centerpiece** ("Said X · Did Y")
6. Evidence builder + Reflector + streaming ReflectPanel
   → **At this point the product exists. Everything below is rank-ordered polish.**

**HIGH VALUE (in order):**
7. Citations UI (tappable claims → receipts) — the anti-"just ChatGPT" defense
8. The closed-loop moment: a follow-through message visibly flips a commitment to kept (demo gold)
9. Silence detection in reflections
10. Delta vs previous reflection
11. CostBar (/stats: calls + cost per tier)

**OPTIONAL (only if ahead):**
12. /search — "when did I last feel like this?" (embeddings already exist)
13. Deploy (Section 13) — timebox 2 hours total, then ship without it

## 9. Verification battery (FIRST thing once the key is in .env — record results as comments atop gateway.js)

1. Basic chat round-trip works. (Blocker → event Discord.)
2. `/v1/embeddings` exists? (Fallback in 7B if not.)
3. `stream:true` works? (Fallback: fake streaming.)
4. Actual model names available on the DeepSeek starter tokens → set CHEAP_MODEL / STRONG_MODEL in config.
5. Responses include `usage` token counts? (If not: estimate, label "estimated" in CostBar.)

## 10. Demo dataset (a prop — script and rehearse it)

~20 messages entered through the UI:
- **Planted pattern:** one commitment made 3 times, differently worded each time (so embeddings get the credit), zero follow-through.
- **One closed loop:** a different commitment ("call mom") followed later by "finally called mom, went well" → flips to kept on camera.
- **One silence:** a thread mentioned early 3+ times, then absent (backdate timestamps in data.json by hand to trigger silence detection).
- Realistic noise: work stress, a good day, money worry, throwaways.
- Rehearse until the reflection reliably: names the pattern with dates, cites receipts, flags the silence, notes the delta, gives one grounded suggestion.

## 11. Runtime feature table (goes in README with real file/function names — the spot-prize argument)

| Runtime feature | Where it lives |
|---|---|
| Agents | The signal-vs-noise pipeline: tagging → ledger → silence detection → synthesis |
| Retrieval & Memory | The entire product: full-history evidence, previous-reflection delta |
| Embeddings | Threads + follow-through matching (`patterns.js`) |
| Streaming | The live reflection (`/reflect` SSE) |
| Model routing | Cheap model always-on (tagging, yes/no checks) vs strong model rarely (reflection) — real cost asymmetry |
| Usage & Billing | CostBar showing the split in dollars (`/stats`) |

## 12. OUT of scope (do not build, do not suggest)

Databases/ORMs · auth/accounts · Telegram/WhatsApp/notifications · voice input · proactive nudges · fine-tuning/local models · WebSockets · settings UI · gamified streaks · mood charts · any third-party service beyond the gateway, GitHub, and Section 13 hosts. These go in the README "What's next" section (shared-commitment accountability is the flagship future idea).

## 13. Deploy (optional, timeboxed 2h, only after step 11)

- Backend → Render/Railway free tier; key as dashboard env var; free tiers cold-start 30–60s — warm before demos.
- Frontend → Vercel/Netlify; backend URL via `VITE_API_URL`.
- ✅ Full loop works on the user's phone. Live URL to top of README.
- A repo running locally in 3 commands + a great video is a valid submission; deployment is bonus.

## 14. Video script (2 min — record after the noon freeze)

- 0:00–0:15 — "Your journal knows what you said. Your tracker knows what you did. Anchor knows the difference."
- 0:15–0:40 — Texting montage, tag chips appearing; the "call mom" follow-through message visibly flips a ledger entry to KEPT.
- 0:40–1:25 — Reflect: streamed reflection catches the 3 broken gym promises with dates → tap a claim → the receipts appear → the silence question ("gone quiet on the startup — dropped or resolved?").
- 1:25–1:45 — Ledger centerpiece ("Said 9 · Did 3") + CostBar ("cheap attention all day, expensive insight on demand — the runtime doing what it's built for").
- 1:45–2:00 — "Anchor. It remembers what you're avoiding."

## 15. README structure (the second demo)

One-liner + pitch line → live URL if deployed → GIF of reflect + citation tap → the problem (3 sentences) → how it works + small diagram → Section 11 table → run locally in 3 commands → "a thinking companion, not therapy" line → What's next.

## 16. Failure modes to avoid

Extras before the core loop works · SSE past its timebox · trusting model JSON without try/catch · committing .env · unrehearsed demo data · features after the noon freeze · skipping the citation feature (it is the moat, not decoration).

## 17. Status / next action

Spec v2 locked (say–do mirror). Next: confirm which build step the code is actually at, then proceed down Section 8 in order. Deadline: **tomorrow, July 7, 4:00 PM Abuja — freeze at noon.**

*Anchor — it remembers what you're avoiding.*
