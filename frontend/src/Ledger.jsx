import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function Ledger() {
  const [ledger, setLedger] = useState(null);
  const [flashId, setFlashId] = useState(null);

  useEffect(() => {
    const load = () =>
      fetch(`${API}/ledger`)
        .then((r) => r.json())
        .then(setLedger)
        .catch(() => {});
    load();
    const id = setInterval(load, 5000);
    const onFlip = (e) => {
      load();
      if (e.detail) {
        setFlashId(e.detail.id);
        setTimeout(() => setFlashId(null), 3000);
      }
    };
    window.addEventListener("anchor:ledger", onFlip);
    return () => {
      clearInterval(id);
      window.removeEventListener("anchor:ledger", onFlip);
    };
  }, []);

  if (!ledger || ledger.said === 0) return null;

  return (
    <div className="ledger">
      <div className="ledger-score">
        Said {ledger.said} · Did {ledger.did}
      </div>
      <ul className="ledger-list">
        {ledger.entries.map((e) => (
          <li key={e.id} className={`ledger-row ${e.id === flashId ? "just-kept" : ""}`}>
            <span className={`badge ${e.status}`}>
              {e.status === "kept" ? "✓ kept" : e.status === "drifting" ? "· drifting" : "○ open"}
            </span>
            <span className="ledger-text">"{e.text}"</span>
            <span className="ledger-age">{e.days_ago === 0 ? "today" : `${e.days_ago}d ago`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
