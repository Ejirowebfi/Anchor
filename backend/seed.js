// Seeds the demo dataset (Section 10): ~20 messages over two weeks.
// Planted pattern: gym commitment made 3 times in different words, never kept.
// Plus one KEPT commitment (call mom) for contrast, and realistic noise.
// Usage: node seed.js   (wipes nothing — appends to current store; delete
// data.json first for a clean slate)

import "dotenv/config";
import { tagMessage } from "./gateway.js";
import { addMessage, getAll } from "./store.js";

const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();

// [days ago, text]
const SEED = [
  // the silence thread: active early, then never mentioned again
  [20, "that app idea for tracking spare parts keeps living in my head rent free"],
  [17, "sketched some screens for the spare-parts app during lunch, this could be something"],
  [15, "told Tunde about the spare-parts app, he thinks it could actually work"],
  [13, "work is drowning me, three deadlines this week"],
  [13, "I'll start gym on Monday, for real this time"],
  [12, "so tired, slept like 4 hours"],
  [11, "lunch with Tunde was actually fun"],
  [11, "rent is due next week and the account is looking scary"],
  [10, "skipped the gym, monday came and went lol"],
  [9, "boss moved the deadline AGAIN, i can't"],
  [8, "gonna call mom this weekend"],
  [7, "new week new me — hitting the weights tomorrow"],
  [6, "called mom, we talked for an hour, she's doing fine"],
  [6, "good day today honestly, work was calm"],
  [5, "why am i so exhausted all the time"],
  [5, "money's tight, might have to skip the concert"],
  [4, "didn't work out again, whatever"],
  [3, "ok signing up for the gym this week, no excuses"],
  [2, "work party was fun, nice break"],
  [2, "this 2am sleep schedule is killing me"],
  [1, "deadline finally shipped, huge relief"],
  [1, "walked past that gym near the house again, place looks nice"],
  [0, "the jollof at the new place is overrated"],
];

console.log(`Seeding ${SEED.length} messages (store currently has ${getAll().length})…\n`);
for (const [d, text] of SEED) {
  const { tags, tokens_used } = await tagMessage(text);
  const m = addMessage({ text, tags, tokens_used, timestamp: daysAgo(d) });
  console.log(
    `#${m.id} ${m.timestamp.slice(0, 10)} [${tags.topic}/${tags.mood}]${tags.is_commitment ? " 📌" : ""} ${text}`
  );
}
console.log(`\nDone. Store now has ${getAll().length} messages.`);
