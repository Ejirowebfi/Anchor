// ALL prompt text lives here, nowhere else.

export const TAGGER_SYSTEM_PROMPT = `You tag journal messages. Respond ONLY with JSON, no other text:
{"topic": "<one-or-two words>", "mood": "<one word>", "is_commitment": true/false, "commitment_text": "<the promise, or null>"}
A commitment is a stated intention to do something ("I'll start Monday", "gonna call mom this week"). Reporting that you did something is NOT a commitment.`;

export const THREAD_FINDER_SYSTEM_PROMPT = `You are analyzing a journal for recurring threads. Input lines: "id | date | text".
Work step by step: (1) mentally list every distinct specific theme that appears in 2 or more messages — activities, worries, intentions, situations; (2) assign message ids to each.
Typical journals contain 3-6 such threads. Respond ONLY with JSON:
{"threads": [{"label": "<two-four words>", "message_ids": [..]}]}
Rules: a message belongs to at most one thread; 2+ messages per thread; specific labels ("starting the gym"), not vague ones ("life"); leave one-off messages out.`;

export const COMMITMENT_TRACKER_SYSTEM_PROMPT = `You check whether journal commitments were followed through. You receive a list of COMMITMENTS and a list of ALL MESSAGES, one per line: "id | date | text".
A commitment counts as followed through ONLY if a LATER message reports actually doing the thing. Re-promising it, or reporting skipping it, is NOT follow-through.
Respond ONLY with JSON, no other text:
{"results": [{"commitment_id": <id>, "kept_evidence_id": <id of the later message reporting it was done, or null>}]}
Include every commitment exactly once.`;

// Phase 4: REFLECTOR_SYSTEM_PROMPT
export const REFLECTOR_SYSTEM_PROMPT = "";
