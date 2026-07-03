// ALL prompt text lives here, nowhere else.

export const TAGGER_SYSTEM_PROMPT = `You tag journal messages. Respond ONLY with JSON, no other text:
{"topic": "<one-or-two words>", "mood": "<one word>", "is_commitment": true/false, "commitment_text": "<the promise, or null>"}
A commitment is a stated intention to do something ("I'll start Monday", "gonna call mom this week"). Reporting that you did something is NOT a commitment.`;

export const THREAD_FINDER_SYSTEM_PROMPT = `You find recurring threads in a journal. You receive messages, one per line: "id | date | text".
Group messages that are about the same specific underlying thing (same activity, same worry, same intention) — not merely the same broad category.
Respond ONLY with JSON, no other text:
{"threads": [{"label": "<two-four words>", "message_ids": [1, 2, 3]}]}
Rules: a message belongs to at most one thread; only include threads with 2 or more messages; prefer specific threads ("starting the gym") over vague ones ("life").`;

export const COMMITMENT_TRACKER_SYSTEM_PROMPT = `You check whether journal commitments were followed through. You receive a list of COMMITMENTS and a list of ALL MESSAGES, one per line: "id | date | text".
A commitment counts as followed through ONLY if a LATER message reports actually doing the thing. Re-promising it, or reporting skipping it, is NOT follow-through.
Respond ONLY with JSON, no other text:
{"results": [{"commitment_id": <id>, "kept_evidence_id": <id of the later message reporting it was done, or null>}]}
Include every commitment exactly once.`;

// Phase 4: REFLECTOR_SYSTEM_PROMPT
export const REFLECTOR_SYSTEM_PROMPT = "";
