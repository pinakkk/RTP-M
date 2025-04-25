import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import "./App.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8080";
const socket = io(BACKEND_URL, {
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling']
});

function App() {
  const [processes, setProcesses] = useState([]);
  const [apps, setApps] = useState([]);
  const [systemStats, setSystemStats] = useState({});
  const [view, setView] = useState("apps");
  const [filter, setFilter] = useState("");
  const [sortBy, setSortBy] = useState("memory");
  const [cpuData, setCpuData] = useState([]);
  const [memoryData, setMemoryData] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [dataReceived, setDataReceived] = useState(false);

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Socket connected");
      setConnectionStatus("Connected");
    });
    
    socket.on("processData", (data) => {
      console.log("Full data received:", data); // Debug full data object
      
      if (data && data.allProcesses && Array.isArray(data.allProcesses)) {
        console.log("Process count:", data.allProcesses.length);
        setProcesses(data.allProcesses);
        setDataReceived(true);
      } else {
        console.error("Invalid process data received:", data.allProcesses);
      }
      
      if (data && data.apps && Array.isArray(data.apps)) {
        setApps(data.apps);
      }
      
      if (data && data.systemStats) {
        setSystemStats(data.systemStats);
        
        setCpuData((prev) => {
          const newData = [...prev.slice(-19), Number(data.systemStats.totalCpuUsage)].slice(-20);
          return newData;
        });
        setMemoryData((prev) => [
          ...prev.slice(-19),
          ((data.systemStats.usedMemory / data.systemStats.totalMemory) * 100).toFixed(2),
        ].slice(-20));
      }
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      setConnectionStatus(`Connection error: ${err.message}`);
    });

    socket.on('disconnect', () => {
      console.log("Socket disconnected");
      setConnectionStatus("Disconnected - trying to reconnect...");
    });

    return () => {
      socket.off("connect");
      socket.off("processData");
      socket.off('connect_error');
      socket.off('disconnect');
    };
  }, []);

  const getFilteredAndSortedData = (data) => {
    let filtered = data.filter((proc) =>
      proc.name.toLowerCase().includes(filter.toLowerCase())
    );
    return filtered.sort((a, b) =>
      sortBy === "memory"
        ? parseFloat(b.memory) - parseFloat(a.memory)
        : parseFloat(b.cpu) - parseFloat(a.cpu)
    );
  };

  const exportToCSV = () => {
    const data = view === "apps" ? apps : processes;
    const csvContent =
      "data:text/csv;charset=utf-8," +
      (view === "apps"
        ? "Name,Instances,CPU (%),Memory (MB)\n" +
          data.map((p) => `${p.name},${p.instances},${p.cpu},${p.memory}`).join("\n")
        : "Name,PID,CPU (%),Memory (MB)\n" +
          data.map((p) => `${p.name},${p.pid},${p.cpu},${p.memory}`).join("\n"));
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `processes_${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const chartOptions = {
    responsive: true,
    scales: { y: { min: 0, max: 100 } },
  };

  const cpuChartData = {
    labels: Array(cpuData.length).fill().map((_, i) => i),
    datasets: [{ label: "CPU Usage (%)", data: cpuData, borderColor: "blue", fill: false }],
  };

  const memoryChartData = {
    labels: Array(memoryData.length).fill().map((_, i) => i),
    datasets: [
      { label: "Memory Usage (%)", data: memoryData, borderColor: "green", fill: false },
    ],
  };

  return (
    <div className="dashboard">
      <header>
        <h1>Real-Time Process Monitoring</h1>
        <div className="toggle-buttons">
          <button className={view === "apps" ? "active" : ""} onClick={() => setView("apps")}>
            App Usage
          </button>
          <button className={view === "all" ? "active" : ""} onClick={() => setView("all")}>
            All Processes
          </button>
          <button className={view === "stats" ? "active" : ""} onClick={() => setView("stats")}>
            System Stats
          </button>
        </div>
        <p className="connection-status">{connectionStatus}</p>
      </header>

      <div className="connection-status">
        {connectionStatus}
        {dataReceived ? ` | Data received` : " | Waiting for data..."}
      </div>

      {view !== "stats" && (
        <>
          <div className="controls">
            <input
              type="text"
              placeholder="Filter by name..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="memory">Sort by Memory</option>
              <option value="cpu">Sort by CPU</option>
            </select>
            <button onClick={exportToCSV}>Export to CSV</button>
          </div>

          <div className="processList">
            <h2>{view === "apps" ? "Application Usage" : "All Processes Usage"}</h2>
            <ul>
              {getFilteredAndSortedData(view === "apps" ? apps : processes).map((process, index) => (
                <li key={index}>
                  {view === "apps" ? (
                    <span>{process.name} ({process.instances} instances)</span>
                  ) : (
                    <span>{process.name} | PID: {process.pid}</span>
                  )}
                  | CPU: {process.cpu}% | Memory: {process.memory} MB
                </li>
              ))}
            </ul>
          </div>

          {(view === "all" && processes.length === 0) && (
            <div className="error-message">
              No process data received from the server.
              <br />
              <small>Check server connection and make sure process_monitor.py is working.</small>
            </div>
          )}

          {(view === "apps" && apps.length === 0) && (
            <div className="error-message">
              No application data received from the server.
              <br />
              <small>Check server connection and make sure process_monitor.py is working.</small>
            </div>
          )}
        </>
      )}

      {view === "stats" && (
        <div className="stats">
          <div className="stat">
            <h2>Total CPU Usage</h2>
            <p>{systemStats.totalCpuUsage}%</p>
            <Line data={cpuChartData} options={chartOptions} />
          </div>
          <div className="stat">
            <h2>Total Memory Usage</h2>
            <p>{systemStats.usedMemory} / {systemStats.totalMemory} GB</p>
            <Line data={memoryChartData} options={chartOptions} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;