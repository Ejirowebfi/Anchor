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
import { recordCheap } from "./stats.js";
import { getLedger } from "./patterns.js";
import {
  TAGGER_SYSTEM_PROMPT,
  THREAD_FINDER_SYSTEM_PROMPT,
  COMMITMENT_TRACKER_SYSTEM_PROMPT,
  FOLLOWTHROUGH_CHECK_SYSTEM_PROMPT,
  REFLECTOR_SYSTEM_PROMPT,
} from "./prompts.js";

export const client = new OpenAI({
  baseURL: process.env.BTL_BASE_URL,
  apiKey: process.env.BTL_API_KEY,
});

const FALLBACK_TAGS = { topic: "general", mood: "neutral", is_commitment: false, commitment_text: null };

// Cheap model tags every message. A bad tag must never crash the app:
// any failure (network, refusal, malformed JSON) falls back to neutral tags.
export async function tagMessage(text) {
  try {
    const res = await client.chat.completions.create({
      model: process.env.MODEL_CHEAP,
      temperature: 0,
      max_tokens: 120,
      messages: [
        { role: "system", content: TAGGER_SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
    });
    recordCheap(res.usage?.total_tokens ?? 0);
    const raw = res.choices[0].message.content.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw);
    return {
      tags: {
        topic: String(parsed.topic ?? "general").toLowerCase(),
        mood: String(parsed.mood ?? "neutral").toLowerCase(),
        is_commitment: parsed.is_commitment === true,
        commitment_text: parsed.is_commitment === true ? parsed.commitment_text ?? null : null,
      },
      tokens_used: res.usage?.total_tokens ?? 0,
    };
  } catch (err) {
    console.error("tagMessage fallback:", err.message);
    return { tags: { ...FALLBACK_TAGS }, tokens_used: 0 };
  }
}

function parseJson(res) {
  const raw = res.choices[0].message.content.replace(/```json|```/g, "").trim();
  return JSON.parse(raw);
}

const asLine = (m) => `${m.id} | ${m.timestamp.slice(0, 10)} | ${m.text}`;

// Embeddings replacement (gateway has no /v1/embeddings — see battery notes):
// one batched cheap-model call groups related messages into threads.
export async function findThreads(messages) {
  if (messages.length < 2) return { threads: [], tokens_used: 0 };
  try {
    const res = await client.chat.completions.create({
      model: process.env.MODEL_CHEAP,
      temperature: 0,
      max_tokens: 800,
      messages: [
        { role: "system", content: THREAD_FINDER_SYSTEM_PROMPT },
        { role: "user", content: messages.map(asLine).join("\n") },
      ],
    });
    recordCheap(res.usage?.total_tokens ?? 0);
    const byId = new Map(messages.map((m) => [m.id, m]));
    const threads = (parseJson(res).threads || [])
      .map((t) => ({
        label: String(t.label || "untitled"),
        messages: (t.message_ids || []).map((id) => byId.get(id)).filter(Boolean),
      }))
      .filter((t) => t.messages.length >= 2)
      .sort((a, b) => b.messages.length - a.messages.length);
    return { threads, tokens_used: res.usage?.total_tokens ?? 0 };
  } catch (err) {
    console.error("findThreads fallback:", err.message);
    return { threads: [], tokens_used: 0 };
  }
}

const FOLLOWUP_DAYS = Number(process.env.FOLLOWUP_DAYS || 3);

// For every message tagged as a commitment, check later messages for a
// follow-through report. Status: "kept" / "open" (recent) / "no follow-up after N days".
export async function trackCommitments(messages) {
  const commitments = messages.filter((m) => m.tags?.is_commitment);
  if (!commitments.length) return { commitments: [], tokens_used: 0 };

  let results = new Map(); // commitment id -> evidence id or null
  let tokens_used = 0;
  try {
    const res = await client.chat.completions.create({
      model: process.env.MODEL_CHEAP,
      temperature: 0,
      max_tokens: 600,
      messages: [
        { role: "system", content: COMMITMENT_TRACKER_SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `COMMITMENTS:\n${commitments.map(asLine).join("\n")}\n\n` +
            `ALL MESSAGES:\n${messages.map(asLine).join("\n")}`,
        },
      ],
    });
    tokens_used = res.usage?.total_tokens ?? 0;
    recordCheap(tokens_used);
    for (const r of parseJson(res).results || []) {
      results.set(r.commitment_id, r.kept_evidence_id ?? null);
    }
  } catch (err) {
    console.error("trackCommitments fallback (statuses by age only):", err.message);
  }

  const byId = new Map(messages.map((m) => [m.id, m]));
  const report = commitments.map((c) => {
    const evidenceId = results.get(c.id) ?? null;
    const evidence = evidenceId != null ? byId.get(evidenceId) : null;
    const days = Math.floor((Date.now() - new Date(c.timestamp)) / 86400000);
    let status;
    if (evidence) status = "kept";
    else if (days >= FOLLOWUP_DAYS) status = `no follow-up after ${days} days`;
    else status = "open";
    return {
      id: c.id,
      date: c.timestamp.slice(0, 10),
      commitment: c.tags.commitment_text || c.text,
      status,
      evidence: evidence ? { id: evidence.id, text: evidence.text } : null,
    };
  });
  return { commitments: report, tokens_used };
}

// Pre-chewed evidence for the reflector: threads + commitment report + mood
// tally. Never dump raw history on the strong model.
export async function buildEvidence(messages) {
  // Threads need one cheap call; commitments come free from the live ledger.
  const threadRes = await findThreads(messages);
  const { entries: ledgerEntries, said, did } = getLedger();
  const moods = {};
  for (const m of messages) {
    const mood = m.tags?.mood || "neutral";
    moods[mood] = (moods[mood] || 0) + 1;
  }
  const stamps = messages.map((m) => new Date(m.timestamp).getTime());
  const days = messages.length
    ? Math.max(1, Math.round((Math.max(...stamps) - Math.min(...stamps)) / 86400000))
    : 0;
  const byId = new Map(messages.map((m) => [m.id, m]));
  return {
    threads: threadRes.threads,
    ledger: { said, did, entries: ledgerEntries },
    byId,
    moods,
    days,
    count: messages.length,
    tokens_used: threadRes.tokens_used,
  };
}

export function evidenceToText(ev) {
  const lines = [`JOURNAL: ${ev.count} messages over ${ev.days} days.`, "", "RECURRING THREADS:"];
  if (!ev.threads.length) lines.push("(none found)");
  for (const t of ev.threads) {
    lines.push(`▶ ${t.label} (${t.messages.length} messages)`);
    for (const m of t.messages) lines.push(`  - [${m.id}] ${m.timestamp.slice(0, 10)}: "${m.text}"`);
  }
  lines.push("", `COMMITMENT LEDGER: said ${ev.ledger.said} · did ${ev.ledger.did}`);
  for (const c of ev.ledger.entries) {
    const ev_msg = c.kept_evidence_message_id != null ? ev.byId.get(c.kept_evidence_message_id) : null;
    lines.push(
      `- [${c.source_message_id}] ${c.made_at.slice(0, 10)} "${c.text}" → ${c.status}` +
        (c.status !== "kept" ? ` (${c.days_ago} days ago)` : "") +
        (ev_msg ? ` (kept — they later said [${ev_msg.id}]: "${ev_msg.text}")` : "")
    );
  }
  const tally = Object.entries(ev.moods)
    .sort((a, b) => b[1] - a[1])
    .map(([m, n]) => `${m} x${n}`)
    .join(", ");
  lines.push("", `MOOD TALLY: ${tally}`);
  return lines.join("\n");
}

// Strong model, stream on — runs ONLY on demand.
export function reflectStream(evidence) {
  return client.chat.completions.create({
    model: process.env.MODEL_STRONG,
    stream: true,
    stream_options: { include_usage: true },
    max_tokens: 2500,
    messages: [
      { role: "system", content: REFLECTOR_SYSTEM_PROMPT },
      { role: "user", content: evidenceToText(evidence) },
    ],
  });
}

// Live ledger check: does this new message report doing one of the open
// commitments? One cheap yes/no call per incoming non-commitment message.
export async function checkFollowThrough(openCommitments, text) {
  if (!openCommitments.length) return null;
  try {
    const res = await client.chat.completions.create({
      model: process.env.MODEL_CHEAP,
      temperature: 0,
      max_tokens: 60,
      messages: [
        { role: "system", content: FOLLOWTHROUGH_CHECK_SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `OPEN COMMITMENTS:\n${openCommitments.map((c) => `${c.id} | ${c.text}`).join("\n")}\n\n` +
            `NEW MESSAGE: ${text}`,
        },
      ],
    });
    recordCheap(res.usage?.total_tokens ?? 0);
    const id = parseJson(res).kept_commitment_id;
    return typeof id === "number" ? id : null;
  } catch (err) {
    console.error("checkFollowThrough fallback (no flip):", err.message);
    return null;
  }
}
