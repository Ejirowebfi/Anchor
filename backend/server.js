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
    const stream = await reflectStream(evidence);
    let reflectionText = "";
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        reflectionText += delta;
        send({ token: delta });
      }
    }
    // Gateway returns no usage on streamed responses — estimate at chars/4.
    recordStrong(Math.round((evidenceToText(evidence).length + reflectionText.length) / 4));
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
