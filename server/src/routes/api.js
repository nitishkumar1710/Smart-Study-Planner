import { Router } from "express";
import Task from "../models/Task.js";
import StudyLog from "../models/StudyLog.js";
import { generatePlan } from "../services/scheduler.js";
import { explainPlan } from "../services/llm.js";

export default function apiRoutes(broadcast) {
  const r = Router();
  const wrap = (fn) => (req, res) => fn(req, res).catch((e) => res.status(400).json({ error: e.message }));
  let lastExplanation = "";

  r.get("/tasks", wrap(async (_req, res) => res.json(await Task.find().sort({ deadline: 1 }))));

  r.post("/tasks", wrap(async (req, res) => {
    const task = await Task.create(req.body);
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

  r.post("/logs", wrap(async (req, res) => {
    const log = await StudyLog.create(req.body);
    res.status(201).json(log);
  }));

  r.get("/logs", wrap(async (_req, res) => res.json(await StudyLog.find().sort({ startedAt: -1 }).limit(100))));

  r.get("/plan", wrap(async (_req, res) => {
    res.json({ tasks: await Task.find({ completed: false }).sort({ deadline: 1 }), explanation: lastExplanation });
  }));

  r.post("/plan", wrap(async (_req, res) => {
    const { tasks, trainedOn } = await generatePlan();
    lastExplanation = await explainPlan(tasks, { trainedOn });
    const payload = { tasks, explanation: lastExplanation, trainedOn };
    broadcast({ type: "plan_updated", ...payload });
    res.json(payload);
  }));

  return r;
}
