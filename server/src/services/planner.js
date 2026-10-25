import { generatePlan } from "./scheduler.js";
import { validatePlan } from "./guardrails.js";
import { explainPlan } from "./llm.js";

const state = { explanation: "", warnings: [] };
export const getPlanState = () => state;

/** Schedule (ANN) -> verify (guardrails) -> explain (LLM) -> broadcast (WebSocket). */
export async function replanAndExplain(broadcast) {
  const { tasks, trainedOn } = await generatePlan();
  const check = validatePlan(tasks, { maxPerDay: +process.env.MAX_SESSIONS_PER_DAY || 4 });
  if (!check.ok) console.error("Plan guardrail violations:", check.violations);
  state.warnings = [...check.violations, ...check.warnings];
  state.explanation = await explainPlan(tasks, { trainedOn });
  const payload = { tasks, trainedOn, explanation: state.explanation, warnings: state.warnings };
  broadcast({ type: "plan_updated", ...payload });
  return payload;
}
