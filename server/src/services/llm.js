import { claude, textOf } from "./claude.js";

/** LLM reasoning layer: explains the ANN-based plan in plain language. */
export async function explainPlan(plan, stats) {
  const fallback = ruleBasedExplanation(plan, stats);
  if (!process.env.ANTHROPIC_API_KEY || plan.length === 0) return fallback;

  const summary = plan
    .map((p) => `- ${p.title} (difficulty ${p.difficulty}, due ${p.deadline.toISOString().slice(0, 10)}): ` +
      p.slots.map((s) => `${s.start.toISOString().slice(0, 16)} [pred focus ${s.score}]`).join(", "))
    .join("\n");
  try {
    const data = await claude({
      tag: "explain_plan", maxTokens: 400,
      system: "You are a concise study coach. Given a schedule produced by an ANN that predicts the student's focus per slot, " +
        "explain in under 120 words why the plan is arranged this way and give 2 practical tips. Do not invent data.",
      messages: [{ role: "user", content: `ANN trained on ${stats.trainedOn} past sessions.\nPlan:\n${summary}` }],
    });
    return textOf(data.content) || fallback;
  } catch (err) {
    console.warn("LLM unavailable, using fallback:", err.message);
    return fallback;
  }
}

function ruleBasedExplanation(plan, stats) {
  if (plan.length === 0) return "No pending tasks to schedule. Add a task to get a plan.";
  const source = stats.trainedOn > 0
    ? `based on focus patterns learned from ${stats.trainedOn} of your past sessions`
    : "using a general focus curve (log sessions so the ANN can learn your habits)";
  return `Tasks are ordered by deadline and each session is placed in the highest-predicted-focus slot available before its due date, ${source}. Harder tasks get your best slots first, and daily sessions are capped to avoid burnout.`;
}
