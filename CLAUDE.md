# CLAUDE.md — Anchor Project Handoff

> **Instructions for Claude (Claude Code / VS Code):** This file is the complete, authoritative spec for this project. Read it fully before writing any code. The human (Favourejiro) is the product owner and makes all final decisions — build one milestone at a time, confirm each checkpoint works before moving on, and do not add features beyond this spec without being asked. When in doubt, prefer the simpler option.

---

## 1. What this project is

**Anchor — an agent that actually remembers what you tell it.**

Tagline: *"It remembers what you're avoiding."*

You text it in short bursts through the day (thoughts, worries, plans, complaints). Every message is logged and tagged. When the user asks for a **reflection**, the agent finds recurring patterns across their whole history — especially **commitments they keep making and never following through on** — and streams back a specific, evidence-based reflection.

Not a chatbot. Not a notes app. The pitch: *chatbots forget you; notes apps remember everything but notice nothing. Anchor pays attention.*

## 2. Context: this is a hackathon submission (deadlines are real)

- **Event:** BTL Runtime Hackathon (Bad Theory Labs) · July 3–5, 2026 · fully online
- **The one rule:** every project MUST make its LLM calls through the **BTL runtime** — an OpenAI-compatible gateway (`/v1/chat/completions`, `/v1/responses`, expected `/v1/embeddings`). A scoped API key + free credits are issued at kickoff.
- **Submission:** GitHub repo + 2-minute demo video, due **July 5, 15:00 UTC (4:00 PM Abuja time). Hard deadline.**
- **Prizes:** $500/$300/$200 podium + **$100 spot prize for "best use of the runtime"** — this spot prize is a primary target. The strategy: visibly use many gateway features (agents, embeddings, retrieval/memory, streaming, multi-provider routing, usage & billing) in ways that are load-bearing, not decorative.
- Timeline anchors (Abuja = UTC+1): kickoff Fri Jul 3 4PM · midpoint office hours Sat 4PM · submission Sun 3PM target (4PM deadline) · demo day Sun 6PM · winners Sun 9PM.
- **Commit discipline:** commit after every working step with meaningful messages. All core implementation happens inside the event window (scaffolding before kickoff is allowed prep). Commit history is implicit proof of legitimate work.

## 3. The user's working style (important)

- The user is **vibe-coding**: Claude writes the implementation; the user steers, tests by using the app in the browser, and makes all judgment calls (thresholds, tone, scope cuts).
- **Give the user one milestone at a time.** Never build multiple phases in one shot.
- After each milestone, tell the user exactly how to verify it works by *using* it (not by reading code).
- Remind the user to commit after each passing checkpoint.
- **No scope creep.** If a tempting improvement isn't in this spec, ask first. Section 12 lists what is explicitly out of scope.

## 4. Stack (deliberately boring — do not upgrade it)

- **Frontend:** React + Vite (JavaScript). One page.
- **Backend:** Node.js + Express. Target ~200–300 lines.
- **Storage:** in-memory array + JSON file persistence on disk (load on startup, save on every write). **No database.**
- **AI calls:** official `openai` npm package pointed at the BTL gateway:

```js
import OpenAI from "openai";
const client = new OpenAI({
  baseURL: process.env.BTL_BASE_URL,  // given at kickoff, e.g. https://.../v1
  apiKey: process.env.BTL_API_KEY,
});
```

- **Streaming to browser:** Server-Sent Events (SSE). Not WebSockets.
- **Secrets:** `.env` in `backend/`, listed in `.gitignore` from the first commit. Never hardcode keys. Never commit `.env`.

### Repo layout (single repo)

```
anchor/
├── README.md
├── CLAUDE.md                  # this file
├── backend/
│   ├── server.js              # Express app + routes (/message, /reflect SSE, /stats, /ping)
│   ├── gateway.js             # BTL client + tagMessage() + embed() + reflect()
│   ├── prompts.js             # ALL prompt text lives here, nowhere else
│   ├── store.js               # in-memory store + JSON persistence + thread finding
│   ├── .env                   # BTL_API_KEY, BTL_BASE_URL (gitignored)
│   └── data.json              # persisted messages (gitignore optional)
└── frontend/
    └── src/
        ├── App.jsx
        ├── ChatFeed.jsx       # input box + message feed with tag chips
        ├── ReflectPanel.jsx   # Reflect button + streaming output
        └── CostBar.jsx        # cheap-vs-strong spend display
```

## 5. Data model (the app's entire brain)

Every user message becomes one object:

```js
{
  id: 17,
  text: "skipped the gym again, whatever",
  timestamp: "2026-07-04T09:12:00Z",
  tags: {
    topic: "health",            // one-two words
    mood: "resigned",           // one word
    is_commitment: false,
    commitment_text: null       // the promise, when is_commitment is true
  },
  embedding: [/* float array from gateway embeddings */],
  tokens_used: 84               // for the cost bar
}
```

The whole product = an array of these + three AI operations over them.

## 6. The three AI operations

### A. Tagger — cheap model, runs on EVERY message
- Model: cheapest available through the gateway (confirm name at kickoff).
- Temperature 0. Force JSON-only output. Parse inside try/catch; on ANY failure fall back to `{topic:"general", mood:"neutral", is_commitment:false, commitment_text:null}` — a bad tag must never crash the app.

**System prompt (draft — user may tune):**
> You tag journal messages. Respond ONLY with JSON, no other text:
> `{"topic": "<one-or-two words>", "mood": "<one word>", "is_commitment": true/false, "commitment_text": "<the promise, or null>"}`
> A commitment is a stated intention to do something ("I'll start Monday", "gonna call mom this week"). Reporting that you did something is NOT a commitment.

### B. Thread-Finder — embeddings + math, no prompt
- On every message: fetch its embedding via the gateway.
- On Reflect: cosine similarity across all message pairs; group pairs above threshold into threads; threads with 3+ messages = recurring patterns.
- **Threshold starts at 0.80 — the USER tunes this by hand with test data.** Ask them to test; do not silently pick a value.

### C. Reflector — strong model, runs ONLY on demand
- Model: strongest available through the gateway.
- The backend builds pre-chewed **evidence** first (top threads with texts+dates, commitment report, mood tally). Never dump raw message history on the model.
- Called with `stream: true`, piped to the frontend via SSE.

**System prompt (draft — expect ~5 revision rounds with the user on day 2; this prompt is the product's soul):**
> You are Anchor, a companion who has been quietly paying attention. You receive: recurring threads (grouped messages with dates), detected commitments and whether follow-through was ever mentioned, and mood counts. Write a short reflection (max 180 words) that:
> - Names the most significant pattern, with specifics: how many times, over how many days, quoting a short phrase or two of theirs
> - If a commitment was repeated with no follow-through, address it directly but kindly — curious, not judgmental
> - Ends with one genuine question
> Never give generic advice ("sleep more", "stay positive"). Every claim must trace to the evidence provided. If the evidence is thin, say so honestly rather than inventing depth.

### Commitment tracking (part of evidence building)
For each message tagged `is_commitment: true`, check later messages (embedding similarity) for follow-through reports. Status per commitment: `open` / `kept` / `no follow-up after N days`. This feeds the Reflector — the repeated-broken-commitment catch is the demo's money moment.

## 7. Kickoff verification battery (FIRST 30 MINUTES after API key arrives — before building anything)

Run in order; record results as comments at top of `gateway.js`:

1. **Basic chat round-trip** works through the gateway. (Blocker if not — user asks in event Discord.)
2. **`/v1/embeddings` exists?** Advertised but UNVERIFIED. Fallback if missing: use the cheap chat model to judge "do these two messages refer to the same thing? yes/no" for thread matching.
3. **`stream: true` works?** Fallback if broken: fetch full response, reveal word-by-word in the frontend (visually identical — acceptable).
4. **Which model names are available** → pick the cheap/strong pair; keep model names in a config/env so switching is a one-line edit.
5. **Does the response include a `usage` field** (token counts)? If yes → real costs in CostBar; if no → estimate and label "estimated".

Every assumption has a fallback. Nothing is load-bearing on an unverified assumption.

## 8. Build phases with checkpoints (execute in order; do not skip checkpoints)

**PHASE 0 — Scaffold (pre-kickoff, allowed prep)**
1. Vite React app in `frontend/`; `backend/` with express, openai, cors, dotenv installed; empty module files; `.env` gitignored.
2. `GET /ping` → `{ok:true}`; frontend button fetches it and displays result (CORS or Vite proxy).
   ✅ Browser button shows backend response. Commit.

**PHASE 1 — Gateway (Fri ~4:00–4:45 PM)**
3. Wire client with real key/URL. ✅ Test script gets a reply.
4. Run the Section 7 battery. ✅ Results recorded. Commit.

**PHASE 2 — Message pipeline (Fri evening) — Friday finish line**
5. `store.js`: addMessage/getAll + JSON persistence. ✅ Survives server restart.
6. `tagMessage()` with safe JSON parsing. ✅ "I'll start gym Monday" → `is_commitment: true`.
7. `POST /message`: text → tag → embed → store → return. ✅ curl round-trip works; data.json grows.
8. Chat UI: input + feed + tag chips (topic, mood, commitment marker). ✅ Typed message appears tagged in browser. Commit, push.

**PHASE 3 — Pattern brain (Sat morning)**
9. Cosine similarity + `findThreads()` grouping above threshold, sorted by size. ✅ Seed 20 fake messages incl. 3 gym-themed in different words → they form one thread. USER tunes threshold.
10. Commitment tracking (open/kept/no-follow-up). ✅ Seed data reports 3 gym commitments, zero follow-through. Commit.

**PHASE 4 — Reflector (Sat afternoon) — Saturday finish line = complete product**
11. Evidence builder. ✅ Printed evidence lets a human see the pattern.
12. `reflect(evidence)` on strong model. ✅ Terminal output names the gym pattern with specifics; if mushy, fix prompt NOW.
13. `GET /reflect` as SSE; ReflectPanel streams words in. ⏱ Timebox SSE to 90 minutes, then use the fake-streaming fallback. ✅ Button press → live streamed reflection catching the planted pattern. Commit, push.

**PHASE 5 — Proof layer (Sat evening)**
14. Cost accounting per model tier; `GET /stats`; CostBar UI ("47 tag calls · $0.02 (fast) | 1 reflection · $0.03 (strong)"). ✅ Numbers move with use.
15. Full dress rehearsal on the demo dataset (Section 10). ✅ End-to-end works. Commit, push, sleep.

**PHASE 6 — Deploy (Sun morning) ⏱ timebox 2 hours total, then ship without it**
16. Backend → Render/Railway free tier; `BTL_API_KEY` as env var in their dashboard. Note: free tiers cold-start ~30–60s — warm before demos. ✅ Public /ping responds.
17. Frontend → Vercel/Netlify; backend URL via `VITE_API_URL`. ✅ Full loop works on the user's phone. Live URL to top of README.
    (A repo that runs locally in 3 commands + great video is a valid submission — deployment is bonus, not core.)

**PHASE 7 — Submission (Sun, done by 3 PM; deadline 4 PM Abuja)**
18. **Feature freeze at noon.** Record the 2-min video (script in Section 11), 2–3 takes max.
19. README per Section 13. ✅ A stranger understands, sees it working, can run it.
20. Final push; verify repo logged-out (no .env, README renders); submit; screenshot confirmation. Target 3 PM.

**If behind schedule, cut from the top, never the bottom:** deployment first → CostBar → commitment tracking. Untouchable core: Phases 1–4 (message → tags → threads → streamed reflection).

## 9. Runtime feature mapping (the spot-prize argument — keep true as you build)

| BTL runtime feature | Where it lives in Anchor |
|---|---|
| Agents | The decide-what's-signal loop: tagging, thread detection, commitment tracking, reflection synthesis |
| Retrieval & Memory | The entire product — full-history evidence building per reflection |
| Embeddings | Thread finding + commitment follow-through matching (`gateway.js: embed()`, `store.js: findThreads()`) |
| Streaming | The live reflection (`/reflect` SSE → ReflectPanel) |
| Multi-provider routing | Cheap model for constant tagging, strong model for rare synthesis — real cost asymmetry, not decorative |
| Usage & Billing | CostBar showing the split in dollars (`/stats`) |

This table goes in the README verbatim (updated with real file/function names).

## 10. Demo dataset (a prop — script it, rehearse it)

~20 short messages entered through the UI, mixing:
- **The planted pattern:** one commitment repeated 3 separate times with no follow-through (e.g., gym on three different "Mondays"), worded differently each time so embeddings (not word-matching) get the credit.
- Realistic noise: work stress, a good day, a money worry, random throwaway lines.
- Expected reflection: names the 3 gym commitments with dates, kind-but-direct, ends with a question. Rehearse until this lands identically every time.

## 11. The 2-minute video script

- 0:00–0:15 — "Every AI forgets you between chats. Your journal remembers everything but notices nothing. Anchor pays attention." App on screen.
- 0:15–0:45 — Texting montage; tag chips appearing live (cheap model visibly working).
- 0:45–1:30 — Hit Reflect. The streamed reflection catches the repeated commitment with dates. Hold on this. This is the demo.
- 1:30–1:50 — CostBar close-up: cheap always-on attention vs. expensive on-demand insight — "the BTL runtime doing what it's built for: agents, memory, embeddings, streaming, multi-provider routing, one gateway."
- 1:50–2:00 — "Anchor. It remembers what you're avoiding."

## 12. Explicitly OUT of scope (do not build, do not suggest)

- Databases, ORMs, migrations
- User accounts, auth, multi-tenancy
- Mobile app, notifications, WhatsApp/Telegram integrations
- Proactive nudges (stretch idea only — not in the 48h build)
- Fine-tuning, local models
- Settings UI (config via env/constants)
- WebSockets
- Any third-party service beyond: BTL gateway, GitHub, and the deploy hosts in Phase 6

**Deferred nice-to-haves (ONLY if ahead of schedule Sunday morning, in this order):** (1) reflection cites evidence — each claim links to the exact source messages with dates; (2) commitment ledger UI panel ("Made: 9 · Kept: 3"); (3) time-decay weighting so stale threads fade and absences can be noticed.

## 13. README structure (write Sunday; it's the second demo)

1. One-liner + tagline
2. Live URL (if deployed)
3. GIF of the reflection streaming (screen-record → GIF; judges must see the product in 5 seconds)
4. The problem, 3 sentences
5. How it works: cheap-tagger → embeddings/threads → strong-reflector, with a small diagram
6. The runtime feature table from Section 9 (real file/function names)
7. Run locally in 3 commands
8. What's next (mention the deferred features — shows vision without scope creep)

## 14. Known failure modes to actively avoid

1. Building extras before the core loop works end-to-end.
2. Debugging SSE past its 90-minute timebox (use the fallback).
3. Trusting model JSON without try/catch + defaults.
4. Committing `.env` / hardcoding keys (leaked keys get revoked mid-event).
5. Demoing with unrehearsed data.
6. Any new feature after the Sunday-noon freeze.
7. Letting the user skip sleep Friday night — Day 2 quality depends on it.

## 15. Current status / next action

- Idea locked: Anchor. Repo to be created and scaffolded (Phase 0) before kickoff.
- Kickoff: **Friday July 3, 4:00 PM Abuja time** — key arrives, run Section 7 battery, then Phase 1 onward.
- Unknowns pending kickoff: gateway base URL, available model names, embeddings endpoint existence, usage-field availability. All have documented fallbacks.

*Anchor — it remembers what you're avoiding.*
