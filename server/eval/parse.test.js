import test from "node:test";
import assert from "node:assert/strict";
import { parseTask } from "../src/services/parseTask.js";

// Mocked Claude API: first reply has an invalid task, second is corrected -> tests the retry loop.
test("parseTask retries with validator feedback", async () => {
  process.env.ANTHROPIC_API_KEY = "test";
  const good = new Date(Date.now() + 864e5).toISOString();
  const replies = [
    { title: "Essay", difficulty: 9, estimatedMinutes: 120, deadline: good },
    { title: "Essay", difficulty: 4, estimatedMinutes: 120, deadline: good },
  ];
  let calls = 0;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ stop_reason: "tool_use", usage: {},
      content: [{ type: "tool_use", id: `t${calls}`, name: "create_task", input: replies[calls++] }] }),
  });
  const task = await parseTask("Essay due tomorrow, hard, 2 hours");
  assert.equal(calls, 2);
  assert.equal(task.difficulty, 4);
});
