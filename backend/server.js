import "dotenv/config";
import express from "express";
import cors from "cors";
import { tagMessage } from "./gateway.js";
import { addMessage, getAll } from "./store.js";

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
  res.json(message);
});

// Phase 4+: GET /reflect (SSE), GET /stats

app.listen(PORT, () => {
  console.log(`Anchor backend listening on http://localhost:${PORT}`);
});
