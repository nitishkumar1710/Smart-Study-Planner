import { useEffect, useMemo, useState } from "react";
import ChatPanel from "./ChatPanel.jsx";

const WS_URL = import.meta.env.VITE_WS_URL || `ws://${location.hostname}:5000`;
const api = async (path, opts = {}) => {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok && res.status !== 204) throw new Error((await res.json()).error || "Request failed");
  return res.status === 204 ? null : res.json();
};

const emptyForm = { title: "", subject: "", difficulty: 3, estimatedMinutes: 60, deadline: "" };

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [explanation, setExplanation] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [quick, setQuick] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const [t, p] = await Promise.all([api("/tasks"), api("/plan")]);
    setTasks(t);
    setExplanation(p.explanation);
    setWarnings(p.warnings || []);
  };

  useEffect(() => {
    load().catch((e) => setError(e.message));
    let ws, timer;
    const connect = () => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => setLive(true);
      ws.onclose = () => { setLive(false); timer = setTimeout(connect, 2000); };
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.type !== "connected") load().catch(() => {});
      };
    };
    connect();
    return () => { clearTimeout(timer); if (ws) { ws.onclose = null; ws.close(); } };
  }, []);

  const act = async (fn) => {
    setError("");
    try { await fn(); } catch (e) { setError(e.message); }
  };

  const addTask = (e) => {
    e.preventDefault();
    act(async () => {
      await api("/tasks", { method: "POST", body: { ...form, deadline: new Date(form.deadline).toISOString() } });
      setForm(emptyForm);
    });
  };

  const quickAdd = (e) => {
    e.preventDefault();
    if (!quick.trim()) return;
    act(async () => { await api("/tasks/parse", { method: "POST", body: { text: quick } }); setQuick(""); });
  };

  const replan = () => act(async () => {
    setBusy(true);
    try { await api("/plan", { method: "POST" }); } finally { setBusy(false); }
  });

  const logSession = (task) => {
    const focus = Number(prompt(`How focused were you on "${task.title}"? (1-5)`, "4"));
    if (!focus || focus < 1 || focus > 5) return;
    act(() => api("/logs", {
      method: "POST",
      body: { taskId: task._id, difficulty: task.difficulty, focus, durationMin: 60 },
    }));
  };

  const byDay = useMemo(() => {
    const days = {};
    tasks.filter((t) => !t.completed).forEach((t) =>
      t.slots.forEach((s) => {
        const key = new Date(s.start).toDateString();
        (days[key] ||= []).push({ ...s, task: t });
      }));
    Object.values(days).forEach((a) => a.sort((x, y) => new Date(x.start) - new Date(y.start)));
    return Object.entries(days).sort((a, b) => new Date(a[0]) - new Date(b[0]));
  }, [tasks]);

  const fmt = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="app">
      <header>
        <h1>🎓 Smart Study Planner</h1>
        <span className={`pill ${live ? "on" : "off"}`}>{live ? "● Live" : "○ Offline"}</span>
      </header>
      {error && <div className="error">{error}</div>}

      <div className="grid">
        <section className="card">
          <h2>Add task</h2>
          <form onSubmit={quickAdd} className="quick">
            <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder='✨ Describe it: "Physics assignment due Thursday 5pm, hard, 3 hours"' />
          </form>
          <form onSubmit={addTask}>
            <input required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <label>Difficulty: {form.difficulty}
              <input type="range" min="1" max="5" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: +e.target.value })} />
            </label>
            <label>Estimated minutes
              <input type="number" min="15" step="15" value={form.estimatedMinutes} onChange={(e) => setForm({ ...form, estimatedMinutes: +e.target.value })} />
            </label>
            <label>Deadline
              <input required type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </label>
            <button type="submit">Add task</button>
          </form>

          <h2>Tasks</h2>
          <ul className="tasks">
            {tasks.map((t) => (
              <li key={t._id} className={t.completed ? "done" : ""}>
                <div>
                  <strong>{t.title}</strong> <small>{t.subject} · diff {t.difficulty} · due {new Date(t.deadline).toLocaleDateString()}</small>
                </div>
                <div className="actions">
                  <button onClick={() => logSession(t)} title="Log a session so the ANN learns">Log</button>
                  <button onClick={() => act(() => api(`/tasks/${t._id}`, { method: "PATCH", body: { completed: !t.completed } }))}>
                    {t.completed ? "Undo" : "Done"}
                  </button>
                  <button className="danger" onClick={() => act(() => api(`/tasks/${t._id}`, { method: "DELETE" }))}>✕</button>
                </div>
              </li>
            ))}
            {tasks.length === 0 && <li className="empty">No tasks yet.</li>}
          </ul>
        </section>

        <section className="card">
          <div className="row">
            <h2>Your plan</h2>
            <button onClick={replan} disabled={busy}>{busy ? "Planning…" : "✨ Generate plan"}</button>
          </div>
          {warnings.length > 0 && <div className="warn">{warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}</div>}
          {explanation && <p className="explain"><b>AI coach:</b> {explanation}</p>}
          {byDay.length === 0 && <p className="empty">Add tasks, then generate a plan.</p>}
          {byDay.map(([day, items]) => (
            <div key={day} className="day">
              <h3>{day}</h3>
              {items.map((s, i) => (
                <div key={i} className="slot">
                  <span>{fmt(s.start)}–{fmt(s.end)}</span>
                  <span>{s.task.title}</span>
                  <small>focus ≈ {s.score?.toFixed(1)}</small>
                </div>
              ))}
            </div>
          ))}
        </section>
      </div>
      <ChatPanel />
    </div>
  );
}
