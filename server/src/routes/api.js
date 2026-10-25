import { Router } from "express";
import Task from "../models/Task.js";
import StudyLog from "../models/StudyLog.js";
import { replanAndExplain, getPlanState } from "../services/planner.js";
import { parseTask } from "../services/parseTask.js";
import { runAgent } from "../services/agent.js";

export default function apiRoutes(broadcast) {
  const r = Router();
  const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
    const status = /ANTHROPIC_API_KEY/.test(e.message) ? 503 : 400;
    res.status(status).json({ error: e.message });
  });

  r.get("/tasks", wrap(async (_req, res) => res.json(await Task.find().sort({ deadline: 1 }))));

  r.post("/tasks", wrap(async (req, res) => {
    const task = await Task.create(req.body);
    broadcast({ type: "task_created", task });
    res.status(201).json(task);
  }));

  // Natural language -> validated task, e.g. "Physics assignment due Thursday 5pm, hard, 3 hours"
  r.post("/tasks/parse", wrap(async (req, res) => {
    if (!req.body?.text) throw new Error("text is required");
    const task = await Task.create(await parseTask(req.body.text));
    broadcast({ type: "task_created", task });
    res.status(201).json(task);
  }));

  r.patch("/tasks/:id", wrap(async (req, res) => {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!task) return res.status(404).json({ error: "Not found" });
    broadcast({ type: "task_updated", task });
    res.json(task);
  }));

  r.delete("/tasks/:id", wrap(async (req, res) => {
    await Task.findByIdAndDelete(req.params.id);
    broadcast({ type: "task_deleted", id: req.params.id });
    res.status(204).end();
  }));

  r.post("/logs", wrap(async (req, res) => res.status(201).json(await StudyLog.create(req.body))));
  r.get("/logs", wrap(async (_req, res) => res.json(await StudyLog.find().sort({ startedAt: -1 }).limit(100))));

  r.get("/plan", wrap(async (_req, res) => {
    res.json({ tasks: await Task.find({ completed: false }).sort({ deadline: 1 }), ...getPlanState() });
  }));
  r.post("/plan", wrap(async (_req, res) => res.json(await replanAndExplain(broadcast))));

  // Conversational agent with tool calling
  r.post("/agent/chat", wrap(async (req, res) => {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0 || messages[0].role !== "user")
      throw new Error("messages must be a non-empty array starting with a user message");
    res.json(await runAgent(messages.slice(-20), broadcast));
  }));

  return r;
}
