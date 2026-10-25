import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { WebSocketServer, WebSocket } from "ws";
import apiRoutes from "./routes/api.js";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const broadcast = (msg) => {
  const data = JSON.stringify(msg);
  wss.clients.forEach((c) => c.readyState === WebSocket.OPEN && c.send(data));
};

wss.on("connection", (ws) => ws.send(JSON.stringify({ type: "connected" })));

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api", apiRoutes(broadcast));

const PORT = process.env.PORT || 5000;
await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/study-planner");
server.listen(PORT, () => console.log(`Server + WebSocket on :${PORT}`));
