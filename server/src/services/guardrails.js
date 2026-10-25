/** Deterministic checks that sit between LLM output and the database. No imports on purpose. */

export function validateTask(raw, now = new Date()) {
  const errors = [];
  const title = typeof raw?.title === "string" ? raw.title.trim() : "";
  if (!title || title.length > 120) errors.push("title must be 1-120 characters");

  const difficulty = Number(raw?.difficulty ?? 3);
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) errors.push("difficulty must be an integer 1-5");

  const estimatedMinutes = Number(raw?.estimatedMinutes ?? 60);
  if (!Number.isFinite(estimatedMinutes) || estimatedMinutes < 15 || estimatedMinutes > 600)
    errors.push("estimatedMinutes must be between 15 and 600");

  const deadline = new Date(raw?.deadline);
  if (Number.isNaN(deadline.getTime())) errors.push("deadline must be a valid ISO 8601 date-time");
  else if (deadline <= now) errors.push("deadline must be in the future");

  const subject = typeof raw?.subject === "string" && raw.subject.trim() ? raw.subject.trim().slice(0, 60) : "General";
  return { ok: errors.length === 0, errors, value: { title, subject, difficulty, estimatedMinutes, deadline } };
}

/** Verifies a generated plan: hard violations (bugs) vs warnings (not enough capacity). */
export function validatePlan(tasks, { maxPerDay = 4, slotMin = 60 } = {}) {
  const violations = [], warnings = [];
  const seen = new Set(), perDay = new Map();

  for (const t of tasks) {
    if (t.completed) continue;
    for (const s of t.slots) {
      const start = new Date(s.start), end = new Date(s.end);
      if (end > new Date(t.deadline)) violations.push(`"${t.title}" has a session ending after its deadline`);
      const key = start.toISOString();
      if (seen.has(key)) violations.push(`Overlapping sessions at ${key}`);
      seen.add(key);
      const day = start.toDateString();
      perDay.set(day, (perDay.get(day) || 0) + 1);
    }
    const needed = Math.ceil(t.estimatedMinutes / slotMin);
    if (t.slots.length < needed)
      warnings.push(`"${t.title}" needs ${needed}h but only ${t.slots.length}h fit before its deadline`);
  }
  for (const [day, n] of perDay) if (n > maxPerDay) violations.push(`${day} has ${n} sessions (max ${maxPerDay})`);
  return { ok: violations.length === 0, violations, warnings };
}
