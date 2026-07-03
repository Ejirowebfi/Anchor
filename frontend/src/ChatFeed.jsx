import { useEffect, useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function ChatFeed() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const feedRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/messages`)
      .then((r) => r.json())
      .then(setMessages)
      .catch(() => setError("backend unreachable — is it running?"));
  }, []);

  useEffect(() => {
    feedRef.current?.scrollTo(0, feedRef.current.scrollHeight);
  }, [messages]);

  async function send(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${API}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const saved = await res.json();
      setMessages((m) => [...m, saved]);
      setText("");
    } catch (err) {
      setError(`send failed: ${err.message}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat">
      <div className="feed" ref={feedRef}>
        {messages.length === 0 && !error && (
          <p className="empty">Tell me what's on your mind. I'll keep track.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="msg">
            <div className="msg-text">{m.text}</div>
            <div className="chips">
              <span className="chip topic">{m.tags.topic}</span>
              <span className="chip mood">{m.tags.mood}</span>
              {m.tags.is_commitment && <span className="chip commitment">📌 commitment</span>}
            </div>
          </div>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <form className="composer" onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's on your mind?"
          disabled={sending}
          autoFocus
        />
        <button type="submit" disabled={sending || !text.trim()}>
          {sending ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
