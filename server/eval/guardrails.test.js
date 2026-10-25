import test from "node:test";
import assert from "node:assert/strict";
import { validateTask, validatePlan } from "../src/services/guardrails.js";

const future = (h) => new Date(Date.now() + h * 36e5).toISOString();

test("validateTask accepts a good task", () => {
  const r = validateTask({ title: "Physics", difficulty: 4, estimatedMinutes: 180, deadline: future(48) });
  assert.equal(r.ok, true);
});
test("validateTask rejects bad difficulty, past deadline, empty title", () => {
  const r = validateTask({ title: " ", difficulty: 9, estimatedMinutes: 5, deadline: "2020-01-01T10:00:00Z" });
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 4);
});
test("validatePlan flags deadline violations, overlaps and over-capacity", () => {
  const slot = (iso) => ({ start: iso, end: new Date(new Date(iso).getTime() + 36e5).toISOString() });
  const tasks = [
    { title: "A", deadline: "2030-01-01T10:00:00Z", estimatedMinutes: 120, slots: [slot("2030-01-01T09:30:00Z")] },
    { title: "B", deadline: "2030-01-05T10:00:00Z", estimatedMinutes: 60, slots: [slot("2030-01-01T09:30:00Z")] },
  ];
  const r = validatePlan(tasks);
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.includes("after its deadline")));
  assert.ok(r.violations.some((v) => v.includes("Overlapping")));
  assert.ok(r.warnings.some((w) => w.includes("needs 2h")));
});
