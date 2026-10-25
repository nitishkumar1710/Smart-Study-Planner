const ML_URL = process.env.ML_URL || "http://127.0.0.1:8000";

/** Ask the ANN service to score slots. Falls back to a flat score if it is down. */
export async function rankSlots({ logs, difficulty, slots }) {
  try {
    const res = await fetch(`${ML_URL}/rank`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: "default",
        logs: logs.map((l) => ({
          hour: new Date(l.startedAt).getHours(),
          dow: new Date(l.startedAt).getDay(),
          difficulty: l.difficulty,
          focus: l.focus,
        })),
        difficulty,
        slots: slots.map((s) => ({ id: s.id, hour: s.start.getHours(), dow: s.start.getDay() })),
      }),
    });
    if (!res.ok) throw new Error(`ML ${res.status}`);
    const data = await res.json();
    return { scores: new Map(data.scores.map((s) => [s.id, s.score])), trainedOn: data.trained_on };
  } catch (err) {
    console.warn("ML service unavailable, using flat scores:", err.message);
    return { scores: new Map(slots.map((s) => [s.id, 3])), trainedOn: 0 };
  }
}
