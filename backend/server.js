import express from "express";
import http from "http";
import { Server } from "socket.io";
import { spawn } from "child_process";
import cors from "cors";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

app.use(cors());

const getProcessData = () => {
  return new Promise((resolve) => {
    const pythonProcess = spawn("python", ["process_monitor.py"], {
      cwd: "D:/My Projects/MONITOR/RTP-M/backend",
    });

    let output = "";
    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      console.error("Python Error:", data.toString());
    });

    pythonProcess.on("close", (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (error) {
          console.error("Error parsing Python output:", error);
          resolve({
            apps: [],
            totalMemoryUsed: "0.00",
            totalCpuUsed: "0.00",
            allProcesses: [],
            systemStats: { totalCpuUsage: "0.00", totalMemory: "0.00", usedMemory: "0.00" },
          });
        }
      } else {
        console.error("Python process exited with code:", code);
        resolve({
          apps: [],
          totalMemoryUsed: "0.00",
          totalCpuUsed: "0.00",
          allProcesses: [],
          systemStats: { totalCpuUsage: "0.00", totalMemory: "0.00", usedMemory: "0.00" },
        });
      }
    });
  });
};

io.on("connection", (socket) => {
  console.log("Client connected");

  const sendProcessData = async () => {
    const data = await getProcessData();
    socket.emit("processData", data);
  };

  sendProcessData();
  const interval = setInterval(sendProcessData, 3000);

  socket.on("disconnect", () => {
    clearInterval(interval);
    console.log("Client disconnected");
  });
});

server.listen(8080, () => {
  console.log("Server running on http://localhost:8080");
});