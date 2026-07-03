// ALL prompt text lives here, nowhere else.

export const TAGGER_SYSTEM_PROMPT = `You tag journal messages. Respond ONLY with JSON, no other text:
{"topic": "<one-or-two words>", "mood": "<one word>", "is_commitment": true/false, "commitment_text": "<the promise, or null>"}
A commitment is a stated intention to do something ("I'll start Monday", "gonna call mom this week"). Reporting that you did something is NOT a commitment.`;

// Phase 4: REFLECTOR_SYSTEM_PROMPT
export const REFLECTOR_SYSTEM_PROMPT = "";
