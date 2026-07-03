import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function CostBar() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const load = () =>
      fetch(`${API}/stats`)
        .then((r) => r.json())
        .then(setStats)
        .catch(() => {});
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, []);

  if (!stats) return null;
  const dollars = (c) => `$${c.toFixed(3)}`;

  return (
    <footer className="costbar">
      <span>
        ⚡ {stats.cheap.calls} fast calls · {dollars(stats.cheap.cost)}{" "}
        <em>({stats.cheap.model})</em>
      </span>
      <span className="costbar-sep">|</span>
      <span>
        🧠 {stats.strong.calls} {stats.strong.calls === 1 ? "reflection" : "reflections"} · ≈
        {dollars(stats.strong.cost)} <em>({stats.strong.model}, est.)</em>
      </span>
    </footer>
  );
}
