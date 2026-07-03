// Cost accounting per model tier. Cheap-tier tokens are real (gateway returns
// usage on non-streamed calls); strong-tier reflection tokens are ESTIMATED
// (gateway returns no usage on streamed responses — chars/4 heuristic).

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "stats.json");

// $ per 1K tokens, blended in/out — public list prices, overridable via env.
const PRICE_CHEAP_PER_1K = Number(process.env.PRICE_CHEAP_PER_1K || 0.0004); // gpt-4o-mini
const PRICE_STRONG_PER_1K = Number(process.env.PRICE_STRONG_PER_1K || 0.005); // gpt-5.1

let stats = { cheap: { calls: 0, tokens: 0 }, strong: { calls: 0, tokens: 0 } };
try {
  stats = JSON.parse(fs.readFileSync(FILE, "utf8"));
} catch {
  // fresh start
}

const save = () => fs.writeFileSync(FILE, JSON.stringify(stats, null, 2));

export function recordCheap(tokens) {
  if (!tokens) return;
  stats.cheap.calls += 1;
  stats.cheap.tokens += tokens;
  save();
}

export function recordStrong(estimatedTokens) {
  stats.strong.calls += 1;
  stats.strong.tokens += estimatedTokens;
  save();
}

export function getStats() {
  return {
    cheap: {
      ...stats.cheap,
      cost: (stats.cheap.tokens / 1000) * PRICE_CHEAP_PER_1K,
      model: process.env.MODEL_CHEAP,
      estimated: false,
    },
    strong: {
      ...stats.strong,
      cost: (stats.strong.tokens / 1000) * PRICE_STRONG_PER_1K,
      model: process.env.MODEL_STRONG,
      estimated: true,
    },
  };
}
