// In-memory message store + JSON file persistence.
// Load on startup, save on every write. No database.
// Phase 3 adds: findThreads() + commitment tracking.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DATA_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "data.json");

let messages = [];

// Load persisted messages on startup.
try {
  messages = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  console.log(`store: loaded ${messages.length} messages from data.json`);
} catch {
  console.log("store: no data.json yet, starting empty");
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(messages, null, 2));
}

export function addMessage({ text, tags, tokens_used = 0, timestamp }) {
  const message = {
    id: messages.length ? messages[messages.length - 1].id + 1 : 1,
    text,
    timestamp: timestamp || new Date().toISOString(),
    tags,
    tokens_used,
  };
  messages.push(message);
  save();
  return message;
}

export function getAll() {
  return messages;
}
