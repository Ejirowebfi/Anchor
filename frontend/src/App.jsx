import { useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

function App() {
  const [pingResult, setPingResult] = useState(null);

  async function testBackend() {
    setPingResult("...");
    try {
      const res = await fetch(`${API}/ping`);
      const data = await res.json();
      setPingResult(JSON.stringify(data));
    } catch (err) {
      setPingResult(`error: ${err.message}`);
    }
  }

  return (
    <main style={{ maxWidth: 600, margin: "4rem auto", textAlign: "center" }}>
      <h1>Anchor</h1>
      <p><em>It remembers what you're avoiding.</em></p>
      <button onClick={testBackend}>Test backend</button>
      {pingResult && (
        <p>
          Backend says: <code>{pingResult}</code>
        </p>
      )}
    </main>
  );
}

export default App;
