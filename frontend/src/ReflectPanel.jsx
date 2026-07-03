import { useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function ReflectPanel() {
  const [state, setState] = useState("idle"); // idle | working | streaming | done | error
  const [status, setStatus] = useState("");
  const [text, setText] = useState("");
  const esRef = useRef(null);

  function reflect() {
    esRef.current?.close();
    setText("");
    setStatus("");
    setState("working");
    const es = new EventSource(`${API}/reflect`);
    esRef.current = es;
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.status) setStatus(data.status);
      if (data.token) {
        setState("streaming");
        setText((t) => t + data.token);
      }
      if (data.error) {
        setState("error");
        setStatus(data.error);
        es.close();
      }
      if (data.done) {
        setState("done");
        es.close();
      }
    };
    es.onerror = () => {
      setState((s) => (s === "done" ? s : "error"));
      setStatus("connection lost — is the backend running?");
      es.close();
    };
  }

  const busy = state === "working" || state === "streaming";

  return (
    <div className="reflect">
      <button className="reflect-btn" onClick={reflect} disabled={busy}>
        {busy ? "Reflecting…" : "Reflect"}
      </button>
      {state === "working" && <p className="reflect-status">{status}</p>}
      {state === "error" && <p className="error">{status}</p>}
      {(state === "streaming" || state === "done") && (
        <div className="reflection">
          {text}
          {state === "streaming" && <span className="cursor">▌</span>}
        </div>
      )}
    </div>
  );
}
