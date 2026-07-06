import "dotenv/config";
import express from "express";
import cors from "cors";
import { tagMessage, buildEvidence, reflectStream, evidenceToText, checkFollowThrough } from "./gateway.js";
import { addMessage, getAll } from "./store.js";
import { getStats, recordStrong } from "./stats.js";
import { addCommitment, openEntries, markKept, getLedger } from "./patterns.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

app.get("/ping", (req, res) => {
  res.json({ ok: true });
});

app.get("/messages", (req, res) => {
  res.json(getAll());
});

app.post("/message", async (req, res) => {
  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "text is required" });
  const { tags, tokens_used } = await tagMessage(text);
  const message = addMessage({ text, tags, tokens_used });

  // Ledger engine: a commitment opens an entry; anything else might close one.
  let ledger_flip = null;
  if (tags.is_commitment) {
    addCommitment(message);
  } else {
    const keptId = await checkFollowThrough(openEntries(), text);
    if (keptId != null) ledger_flip = markKept(keptId, message.id);
  }
  res.json({ message, ledger_flip });
});

app.get("/ledger", (req, res) => {
  res.json(getLedger());
});

app.get("/reflect", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  try {
    const messages = getAll();
    if (messages.length < 3) {
      send({ error: "not enough messages yet — tell me a few more things first" });
      return res.end();
    }
    send({ status: "reading your whole history…" });
    const evidence = await buildEvidence(messages);
    send({ status: "reflecting…" });
    // Structured JSON can't stream to the client mid-parse: accumulate the
    // gateway stream server-side, parse, send whole; client reveals word-by-word.
    const stream = await reflectStream(evidence);
    let raw = "";
    for await (const chunk of stream) {
      raw += chunk.choices?.[0]?.delta?.content || "";
    }
    // Gateway returns no usage on streamed responses — estimate at chars/4.
    recordStrong(Math.round((evidenceToText(evidence).length + raw.length) / 4));
    let reflection;
    try {
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const jsonSlice = cleaned
        .slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1)
        .replace(/,\s*([\]}])/g, "$1"); // trailing commas
      reflection = JSON.parse(jsonSlice);
      if (!Array.isArray(reflection.sections)) throw new Error("no sections array");
    } catch (err) {
      // Bad JSON must never break the demo: show the prose without citations.
      console.error("reflection JSON fallback:", err.message, "| raw head:", raw.slice(0, 120));
      reflection = { sections: [{ claim: raw.trim(), evidence_ids: [] }], suggestion: null, question: null, honesty_note: null };
    }
    send({ reflection });
    send({ done: true });
    res.end();
  } catch (err) {
    console.error("reflect error:", err.message);
    send({ error: "reflection failed — try again in a moment" });
    res.end();
  }
});

app.get("/stats", (req, res) => {
  res.json(getStats());
});

app.listen(PORT, () => {
  console.log(`Anchor backend listening on http://localhost:${PORT}`);
});
