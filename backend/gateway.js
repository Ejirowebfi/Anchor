// BTL gateway client + the three AI operations.
// Filled in during Phase 1 (kickoff verification battery results go here as comments).
//
// Planned exports: tagMessage(text), embed(text), reflect(evidence)

import OpenAI from "openai";

export const client = new OpenAI({
  baseURL: process.env.BTL_BASE_URL,
  apiKey: process.env.BTL_API_KEY,
});
