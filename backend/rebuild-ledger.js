// One-off: rebuild ledger.json from message history (batched cheap-model
// follow-through check). Usage: node rebuild-ledger.js

import "dotenv/config";
import { trackCommitments } from "./gateway.js";
import { getAll } from "./store.js";
import { resetLedger, getLedger } from "./patterns.js";

const messages = getAll();
const { commitments } = await trackCommitments(messages);
const byId = new Map(messages.map((m) => [m.id, m]));

const entries = commitments.map((c, i) => ({
  id: i + 1,
  text: c.commitment,
  source_message_id: c.id,
  made_at: byId.get(c.id).timestamp,
  status: c.status === "kept" ? "kept" : "open",
  kept_evidence_message_id: c.evidence?.id ?? null,
}));

resetLedger(entries);
const ledger = getLedger();
console.log(`Ledger rebuilt: Said ${ledger.said} · Did ${ledger.did}`);
for (const e of ledger.entries) {
  console.log(`  [${e.status}] "${e.text}" (${e.days_ago}d ago)`);
}
