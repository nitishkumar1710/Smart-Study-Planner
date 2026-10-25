import Task from "../models/Task.js";
import StudyLog from "../models/StudyLog.js";
import Block from "../models/Block.js";
import { rankSlots } from "./ml.js";

const DAY_START = +process.env.DAY_START || 7;
const DAY_END = +process.env.DAY_END || 23;
const MAX_PER_DAY = +process.env.MAX_SESSIONS_PER_DAY || 4;
const HORIZON_DAYS = 14;
const SLOT_MIN = 60;

function buildFreeSlots(now) {
  const slots = [];
  const t = new Date(now);
  t.setMinutes(0, 0, 0);
  t.setHours(t.getHours() + 1);
  const end = new Date(now.getTime() + HORIZON_DAYS * 864e5);
  for (; t < end; t.setHours(t.getHours() + 1)) {
    const h = t.getHours();
    if (h >= DAY_START && h < DAY_END) {
      const start = new Date(t);
      slots.push({ id: start.toISOString(), start, end: new Date(start.getTime() + SLOT_MIN * 6e4) });
    }
  }
  return slots;
}

/** Greedy deadline-first scheduler using ANN-predicted focus as slot quality. */
export async function generatePlan() {
  const now = new Date();
  const tasks = await Task.find({ completed: false }).sort({ deadline: 1, difficulty: -1 });
  const logs = await StudyLog.find().sort({ startedAt: -1 }).limit(500);
  const blocks = await Block.find({ end: { $gt: now } });
  const free = buildFreeSlots(now).filter((s) => !blocks.some((b) => s.start < b.end && s.end > b.start));
  const used = new Set();
  const perDay = new Map();
  let trainedOn = 0;

  for (const task of tasks) {
    const needed = Math.ceil(task.estimatedMinutes / SLOT_MIN);
    const candidates = free.filter((s) => !used.has(s.id) && s.end <= task.deadline);
    const { scores, trainedOn: n } = await rankSlots({ logs, difficulty: task.difficulty, slots: candidates });
    trainedOn = n || trainedOn;

    const ranked = candidates
      .map((s) => ({ ...s, score: scores.get(s.id) ?? 3 }))
      .sort((a, b) => b.score - a.score);

    const chosen = [];
    for (const s of ranked) {
      if (chosen.length === needed) break;
      const day = s.start.toDateString();
      if ((perDay.get(day) || 0) >= MAX_PER_DAY) continue;
      chosen.push(s);
      used.add(s.id);
      perDay.set(day, (perDay.get(day) || 0) + 1);
    }
    task.slots = chosen
      .sort((a, b) => a.start - b.start)
      .map((s) => ({ start: s.start, end: s.end, score: s.score }));
    await task.save();
  }
  return { tasks, trainedOn };
}
