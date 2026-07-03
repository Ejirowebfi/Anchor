import ChatFeed from "./ChatFeed.jsx";
import ReflectPanel from "./ReflectPanel.jsx";
import CostBar from "./CostBar.jsx";
import "./App.css";

function App() {
  return (
    <div className="app">
      <header>
        <h1>Anchor</h1>
        <p>It remembers what you're avoiding.</p>
      </header>
      <ReflectPanel />
      <ChatFeed />
      <CostBar />
    </div>
  );
}

export default App;
