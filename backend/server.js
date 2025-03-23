import express from "express";
import http from "http";
import { Server } from "socket.io";
import psList from "ps-list";
import cors from "cors";
import { exec } from "child_process";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());

const getMemoryUsageWMIC = (callback) => {
  exec('wmic process get Name,WorkingSetSize', (error, stdout) => {
    if (error) {
      console.error("WMIC Error:", error);
      return callback([]);
    }

    const lines = stdout.split("\n").slice(1);
    const memoryMap = {};

    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const name = parts.slice(0, -1).join(" ");
        const memory = parseInt(parts[parts.length - 1]) || 0;
        memoryMap[name] = (memoryMap[name] || 0) + memory;
      }
    });

    const processes = Object.keys(memoryMap).map(name => ({
      name,
      memory: `${(memoryMap[name] / 1024 / 1024).toFixed(2)} MB`
    }));

    callback(processes);
  });
};

io.on("connection", (socket) => {
  console.log("Client connected");

  const sendProcessData = () => {
    getMemoryUsageWMIC((wmicProcesses) => {
      const appNames = [
        "chrome.exe", "node.exe", "code.exe", "python.exe", 
        "postman.exe", "slack.exe", "adobe premiere pro.exe", "afterfx.exe"
      ];

      const apps = wmicProcesses.filter(proc => appNames.includes(proc.name.toLowerCase()));
      const totalMemoryUsed = apps.reduce((acc, app) => acc + parseFloat(app.memory), 0);

      socket.emit("processData", {
        apps,
        totalMemoryUsed: `${totalMemoryUsed.toFixed(2)} MB`,
        allProcesses: wmicProcesses
      });
    });
  };

  const interval = setInterval(sendProcessData, 3000);

  socket.on("disconnect", () => {
    clearInterval(interval);
    console.log("Client disconnected");
  });
});

server.listen(8080, () => {
  console.log("Server running on http://localhost:8080");
});
