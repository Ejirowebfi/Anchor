import { useEffect, useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

// Blocks = the reflection flattened for the word-by-word reveal.
function toBlocks(r) {
  const blocks = [];
  r.sections?.forEach((s, i) => blocks.push({ kind: "claim", text: s.claim, ids: s.evidence_ids || [], key: `s${i}` }));
  if (r.suggestion) blocks.push({ kind: "suggestion", text: r.suggestion, key: "sg" });
  if (r.question) blocks.push({ kind: "question", text: r.question, key: "q" });
  if (r.honesty_note) blocks.push({ kind: "note", text: r.honesty_note, key: "n" });
  return blocks;
}

export default function ReflectPanel() {
  const [state, setState] = useState("idle"); // idle | working | revealing | done | error
  const [status, setStatus] = useState("");
  const [blocks, setBlocks] = useState([]);
  const [wordsShown, setWordsShown] = useState(0);
  const [openReceipts, setOpenReceipts] = useState(null);
  const [msgById, setMsgById] = useState({});
  const esRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => () => { esRef.current?.close(); clearInterval(timerRef.current); }, []);

  const totalWords = blocks.reduce((n, b) => n + b.text.split(/\s+/).length, 0);

  useEffect(() => {
    if (state !== "revealing") return;
    timerRef.current = setInterval(() => {
      setWordsShown((w) => {
        if (w + 1 >= totalWords) {
          clearInterval(timerRef.current);
          setState("done");
        }
        return w + 1;
      });
    }, 45);
    return () => clearInterval(timerRef.current);
  }, [state, totalWords]);

  function reflect() {
    esRef.current?.close();
    setBlocks([]);
    setWordsShown(0);
    setOpenReceipts(null);
    setState("working");
    setStatus("");
    fetch(`${API}/messages`)
      .then((r) => r.json())
      .then((ms) => setMsgById(Object.fromEntries(ms.map((m) => [m.id, m]))))
      .catch(() => {});
    const es = new EventSource(`${API}/reflect`);
    esRef.current = es;
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.status) setStatus(data.status);
      if (data.reflection) {
        setBlocks(toBlocks(data.reflection));
        setState("revealing");
      }
      if (data.error) {
        setState("error");
        setStatus(data.error);
        es.close();
      }
      if (data.done) es.close();
    };
    es.onerror = () => {
      setState((s) => (s === "done" || s === "revealing" ? s : "error"));
      setStatus("connection lost — is the backend running?");
      es.close();
    };
  }

  // Distribute revealed words across blocks in order.
  let budget = wordsShown;
  const rendered = blocks.map((b) => {
    const words = b.text.split(/\s+/);
    const take = Math.max(0, Math.min(words.length, budget));
    budget -= take;
    return { ...b, shown: words.slice(0, take).join(" "), complete: take === words.length };
  });

  const busy = state === "working" || state === "revealing";

  return (
    <div className="reflect">
      <button className="reflect-btn" onClick={reflect} disabled={busy}>
        {busy ? "Reflecting…" : "Reflect"}
      </button>
      {state === "working" && <p className="reflect-status">{status}</p>}
      {state === "error" && <p className="error">{status}</p>}
      {(state === "revealing" || state === "done") && (
        <div className="reflection">
          {rendered.map(
            (b) =>
              b.shown && (
                <div key={b.key} className={`refl-block ${b.kind}`}>
                  {b.kind === "claim" && b.ids.length > 0 ? (
                    <>
                      <span
                        className="claim-text"
                        title="tap for receipts"
                        onClick={() => b.complete && setOpenReceipts(openReceipts === b.key ? null : b.key)}
                      >
                        {b.shown}
                        {b.complete && <span className="receipt-hint"> 🧾{b.ids.length}</span>}
                      </span>
                      {openReceipts === b.key && (
                        <ul className="receipts">
                          {b.ids.map((id) =>
                            msgById[id] ? (
                              <li key={id}>
                                <span className="receipt-date">{msgById[id].timestamp.slice(0, 10)}</span>{" "}
                                "{msgById[id].text}"
                              </li>
                            ) : null
                          )}
                        </ul>
                      )}
                    </>
                  ) : (
                    <>
                      {b.kind === "suggestion" && b.complete && <strong>Try this week: </strong>}
                      {b.shown}
                    </>
                  )}
                  {!b.complete && <span className="cursor">▌</span>}
                </div>
              )
          )}
        </div>
      )}
    </div>
  );
}
