import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import "./App.css";

const socket = io("http://localhost:8080");

function App() {
  const [processes, setProcesses] = useState([]);
  const [apps, setApps] = useState([]);
  const [view, setView] = useState("apps");

  useEffect(() => {
    socket.on("processData", (data) => {
      setApps(data.apps);
      setProcesses(data.allProcesses);
    });

    return () => socket.off("processData");
  }, []);

  return (
    <div className="dashboard">
      <header>
        <h1>Real-Time Memory Usage</h1>
        <div className="toggle-buttons">
          <button className={view === "apps" ? "active" : ""} onClick={() => setView("apps")}>
            App Usage
          </button>
          <button className={view === "all" ? "active" : ""} onClick={() => setView("all")}>
            All Processes Usage
          </button>
        </div>
      </header>

      <div className="stats">
        <div className="stat">
          <h2>Total Memory Used</h2>
          <p>{getTotalRAM(view === "apps" ? apps : processes)}</p>
        </div>
      </div>

      <div className="processList">
        <h2>{view === "apps" ? "Application Memory Usage" : "All Processes Memory Usage"}</h2>
        <ul>
          {(view === "apps" ? apps : processes).map((process, index) => (
            <li key={index}>
              <span>{process.name}</span> | Memory: {process.memory}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const getTotalRAM = (processes) => {
  let totalMemory = 0;
  processes.forEach((process) => {
    const memory = parseFloat(process.memory);
    if (!isNaN(memory)) totalMemory += memory;
  });
  return `${totalMemory.toFixed(2)} MB`;
};

export default App;
