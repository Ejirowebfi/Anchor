// Section 7 kickoff verification battery.
// Usage: node battery.js   (after filling BTL_BASE_URL + BTL_API_KEY in .env)
// Record the results as comments at the top of gateway.js.

import "dotenv/config";
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: process.env.BTL_BASE_URL,
  apiKey: process.env.BTL_API_KEY,
});

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`\n${ok ? "✅" : "❌"} ${name}: ${detail}`);
}

if (!process.env.BTL_BASE_URL || !process.env.BTL_API_KEY) {
  console.error("Fill BTL_BASE_URL and BTL_API_KEY in backend/.env first.");
  process.exit(1);
}

// ── 4. Which models are available? (run first — other checks need a model name)
let models = [];
try {
  const list = await client.models.list();
  models = list.data.map((m) => m.id);
  record("4. Model list", true, models.join(", ") || "(empty list)");
} catch (err) {
  record("4. Model list", false, `${err.message} — ask in Discord / check docs for model names`);
}

// Model to test with: first listed, or override via TEST_MODEL env var.
const testModel = process.env.TEST_MODEL || models[0];
console.log(`\nUsing test model: ${testModel}`);

// ── 1. Basic chat round-trip + 5. usage field
try {
  const res = await client.chat.completions.create({
    model: testModel,
    messages: [{ role: "user", content: "Reply with exactly: pong" }],
  });
  record("1. Chat round-trip", true, res.choices[0].message.content.trim());
  const usage = res.usage;
  record(
    "5. Usage field",
    !!usage,
    usage ? `real token counts available: ${JSON.stringify(usage)}` : "missing — CostBar must estimate"
  );
} catch (err) {
  record("1. Chat round-trip", false, `BLOCKER — ${err.message} — ask in event Discord`);
}

// ── 2. /v1/embeddings exists?
try {
  const emb = await client.embeddings.create({
    model: process.env.EMBED_MODEL || "text-embedding-3-small",
    input: "gym on monday",
  });
  const vec = emb.data[0].embedding;
  record("2. Embeddings", true, `works — ${vec.length} dims`);
} catch (err) {
  record("2. Embeddings", false, `${err.message} — fallback: cheap-model yes/no similarity judging`);
}

// ── 3. stream: true works?
try {
  const stream = await client.chat.completions.create({
    model: testModel,
    messages: [{ role: "user", content: "Count from 1 to 5, one number per word." }],
    stream: true,
  });
  let chunks = 0;
  let text = "";
  for await (const chunk of stream) {
    chunks++;
    text += chunk.choices[0]?.delta?.content || "";
  }
  record("3. Streaming", chunks > 1, `${chunks} chunks: "${text.trim()}"${chunks <= 1 ? " — single chunk, use fake-streaming fallback" : ""}`);
} catch (err) {
  record("3. Streaming", false, `${err.message} — fallback: full response revealed word-by-word in frontend`);
}

// ── Summary block, ready to paste into gateway.js
console.log("\n────────────────────────────────────────");
console.log("// Battery results " + new Date().toISOString());
for (const r of results) console.log(`// ${r.ok ? "OK " : "FAIL"} ${r.name}: ${r.detail}`);
console.log("────────────────────────────────────────");
