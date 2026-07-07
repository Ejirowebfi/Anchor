// Ledger state & logic (v2 Section 7C). Entries are derived from messages but
// persisted to ledger.json so kept-flips survive restarts.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "ledger.json");
const DRIFT_DAYS = Number(process.env.DRIFT_DAYS || 10);

let entries = [];
try {
  entries = JSON.parse(fs.readFileSync(FILE, "utf8"));
} catch {
  // no ledger yet — run rebuild-ledger.js to backfill from history
}

const save = () => fs.writeFileSync(FILE, JSON.stringify(entries, null, 2));

export function addCommitment(message) {
  const entry = {
    id: entries.length ? entries[entries.length - 1].id + 1 : 1,
    text: message.tags.commitment_text || message.text,
    source_message_id: message.id,
    made_at: message.timestamp,
    status: "open",
    kept_evidence_message_id: null,
  };
  entries.push(entry);
  save();
  return entry;
}

// Everything not yet kept is checkable for follow-through.
export function openEntries() {
  return entries.filter((e) => e.status !== "kept");
}

export function markKept(entryId, evidenceMessageId) {
  const e = entries.find((x) => x.id === entryId);
  if (!e) return null;
  e.status = "kept";
  e.kept_evidence_message_id = evidenceMessageId;
  save();
  return e;
}

// "drifting" is time-derived at read time: open + older than DRIFT_DAYS.
export function getLedger() {
  const now = Date.now();
  const out = entries.map((e) => {
    const days_ago = Math.floor((now - new Date(e.made_at)) / 86400000);
    const status = e.status === "kept" ? "kept" : days_ago >= DRIFT_DAYS ? "drifting" : "open";
    return { ...e, status, days_ago };
  });
  return {
    said: out.length,
    did: out.filter((e) => e.status === "kept").length,
    entries: [...out].reverse(), // newest first for the UI
  };
}

export function resetLedger(newEntries) {
  entries = newEntries;
  save();
}

// Silence detection (v2 Section 7D, pure math): threads that were active
// (3+ messages) whose last message is older than SILENCE_DAYS.
const SILENCE_DAYS = Number(process.env.SILENCE_DAYS || 14);

export function findSilences(threads) {
  const now = Date.now();
  return threads
    .filter((t) => t.messages.length >= 3)
    .map((t) => {
      const last = t.messages.reduce((a, b) =>
        new Date(a.timestamp) > new Date(b.timestamp) ? a : b
      );
      return {
        label: t.label,
        count: t.messages.length,
        last_date: last.timestamp.slice(0, 10),
        days_quiet: Math.floor((now - new Date(last.timestamp)) / 86400000),
        message_ids: t.messages.map((m) => m.id),
      };
    })
    .filter((s) => s.days_quiet >= SILENCE_DAYS);
}
