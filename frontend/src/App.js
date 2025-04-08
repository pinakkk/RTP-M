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

const socket = io("http://localhost:8080");

function App() {
  const [processes, setProcesses] = useState([]);
  const [apps, setApps] = useState([]);
  const [systemStats, setSystemStats] = useState({});
  const [view, setView] = useState("apps");
  const [filter, setFilter] = useState("");
  const [sortBy, setSortBy] = useState("memory");
  const [cpuData, setCpuData] = useState([]);
  const [memoryData, setMemoryData] = useState([]);

  useEffect(() => {
    socket.on("processData", (data) => {
      setApps(data.apps);
      setProcesses(data.allProcesses);
      setSystemStats(data.systemStats);

      setCpuData((prev) => {
        const newData = [...prev.slice(-19), Number(data.systemStats.totalCpuUsage)].slice(-20);
        console.log("CPU Data:", newData); // Debug log
        return newData;
      });
      setMemoryData((prev) => [
        ...prev.slice(-19),
        ((data.systemStats.usedMemory / data.systemStats.totalMemory) * 100).toFixed(2),
      ].slice(-20));
    });

    return () => socket.off("processData");
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
      </header>

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