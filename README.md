# Anchor

**An agent that actually remembers what you tell it.**

*"It remembers what you're avoiding."*

🚧 **Status:** being built for the **BTL Runtime Hackathon** (Bad Theory Labs, July 3–5, 2026). Demo GIF, live URL, and run instructions land at submission.

---

## The problem

Every AI chatbot forgets you between conversations. Your notes app remembers everything but notices nothing. Neither will ever tell you that you've promised to start going to the gym three separate times in two weeks and never mentioned it again.

Anchor sits in the middle: you text it in short bursts through the day — thoughts, worries, plans, complaints — and it quietly pays attention. When you ask for a **reflection**, it searches your entire history for recurring patterns, especially **commitments you keep making and never following through on**, and streams back a short, specific, evidence-based reflection.

Not a chatbot. Not a notes app. Anchor pays attention.

## How it works

Three AI operations over one growing message log:

```
you type a message
      │
      ▼
┌─────────────┐   cheap model, every message
│  1. TAGGER  │   → topic, mood, is_commitment
└─────────────┘
      │
      ▼
┌─────────────┐   gateway embeddings, every message
│ 2. THREADS  │   → cosine similarity groups related messages
└─────────────┘   → 3+ similar messages = a recurring pattern
      │
      ▼  (only when you hit Reflect)
┌─────────────┐   strong model, on demand
│ 3. REFLECTOR│   → receives pre-built evidence (threads, commitment
└─────────────┘     report, mood tally), streams back a reflection
```

1. **Tagger** — the cheapest model available tags every incoming message with a topic, a mood, and whether it contains a commitment ("I'll start Monday"). Temperature 0, JSON-only, with a safe fallback so a bad tag can never crash the app.
2. **Thread-Finder** — no prompt at all: every message gets an embedding, and at reflection time cosine similarity groups related messages into threads. Three or more similar messages worded differently ("gym tomorrow", "gotta work out", "skipped the gym again") form one recurring pattern — embeddings get the credit, not word-matching.
3. **Reflector** — the strongest model available runs *only on demand*. The backend builds pre-chewed evidence first (top threads with dates, a commitment follow-through report, mood counts) rather than dumping raw history. The response streams live to the browser via Server-Sent Events.

**Commitment tracking:** every message tagged as a commitment is checked against later messages (by embedding similarity) for follow-through. Each commitment ends up `open`, `kept`, or `no follow-up after N days` — the repeated-broken-commitment catch is the heart of the product.

## Data model

No database. Every message is one object in an in-memory array, persisted to a JSON file:

```js
{
  id: 17,
  text: "skipped the gym again, whatever",
  timestamp: "2026-07-04T09:12:00Z",
  tags: {
    topic: "health",
    mood: "resigned",
    is_commitment: false,
    commitment_text: null
  },
  embedding: [/* float array from gateway embeddings */],
  tokens_used: 84
}
```

The whole product = an array of these + the three AI operations above.

## Stack

Deliberately boring:

- **Frontend:** React + Vite (JavaScript), one page — chat feed with live tag chips, a Reflect panel with streaming output, and a cost bar
- **Backend:** Node.js + Express (~200–300 lines)
- **Storage:** in-memory array + JSON file on disk — no database
- **AI:** all LLM calls go through the **BTL runtime** (an OpenAI-compatible gateway) via the official `openai` npm package
- **Streaming:** Server-Sent Events

```
anchor/
├── backend/
│   ├── server.js      # Express routes: /message, /reflect (SSE), /stats, /ping
│   ├── gateway.js     # BTL client: tagMessage(), embed(), reflect()
│   ├── prompts.js     # all prompt text lives here
│   └── store.js       # in-memory store + JSON persistence + thread finding
└── frontend/
    └── src/
        ├── App.jsx
        ├── ChatFeed.jsx      # input + message feed with tag chips
        ├── ReflectPanel.jsx  # Reflect button + streaming output
        └── CostBar.jsx       # cheap-vs-strong spend display
```

## BTL runtime usage

Every LLM call goes through the BTL gateway, and each runtime feature is load-bearing, not decorative:

| BTL runtime feature | Where it lives in Anchor |
|---|---|
| Agents | The decide-what's-signal loop: tagging, thread detection, commitment tracking, reflection synthesis |
| Retrieval & Memory | The entire product — full-history evidence building per reflection |
| Embeddings | Thread finding + commitment follow-through matching |
| Streaming | The live reflection (`/reflect` SSE → ReflectPanel) |
| Multi-provider routing | Cheap model for constant tagging, strong model for rare synthesis — real cost asymmetry |
| Usage & Billing | CostBar showing the cheap-vs-strong spend split in dollars |

## Run locally

*(Coming with the build — target: clone, add your gateway key to `backend/.env`, and start in 3 commands.)*

## What's next

Deferred, in order, only if time allows:

1. **Cited reflections** — each claim links to the exact source messages with dates
2. **Commitment ledger panel** — "Made: 9 · Kept: 3"
3. **Time-decay weighting** — stale threads fade, so absences can be noticed too

---

*Anchor — it remembers what you're avoiding.*
