import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

app.get("/ping", (req, res) => {
  res.json({ ok: true });
});

// Phase 2+: POST /message, GET /reflect (SSE), GET /stats

app.listen(PORT, () => {
  console.log(`Anchor backend listening on http://localhost:${PORT}`);
});
