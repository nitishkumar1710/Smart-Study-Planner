import { useEffect, useRef, useState } from "react";

const post = async (path, body) => {
  const res = await fetch(`/api${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
};

const EXAMPLES = [
  "Add a DBMS exam on Friday 5pm, hard, 4 hours",
  "I'm sick tomorrow, move my sessions",
  "When am I most focused tomorrow?",
];

export default function ChatPanel() {
  const [msgs, setMsgs] = useState([]); // {role, content, toolCalls?}
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [msgs, busy]);

  const send = async (text) => {
    if (!text.trim() || busy) return;
    const next = [...msgs, { role: "user", content: text }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const { reply, toolCalls } = await post("/agent/chat", {
        messages: next.map(({ role, content }) => ({ role, content })),
      });
      setMsgs([...next, { role: "assistant", content: reply || "Done.", toolCalls }]);
    } catch (e) {
      setMsgs([...next, { role: "assistant", content: `⚠️ ${e.message}` }]);
    } finally { setBusy(false); }
  };

  return (
    <section className="card chat">
      <h2>🤖 AI planning assistant</h2>
      <div className="chat-log">
        {msgs.length === 0 && (
          <div className="examples">
            {EXAMPLES.map((e) => <button key={e} onClick={() => send(e)}>{e}</button>)}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.content}
            {m.toolCalls?.length > 0 && (
              <div className="tools">{m.toolCalls.map((t, j) => <span key={j} className={t.ok ? "ok" : "bad"}>🔧 {t.name}</span>)}</div>
            )}
          </div>
        ))}
        {busy && <div className="bubble assistant">Thinking…</div>}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask me to add tasks, reschedule, or suggest focus hours…" />
      </form>
    </section>
  );
}
