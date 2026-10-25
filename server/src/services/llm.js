/** LLM reasoning layer: explains the plan in plain language. */
export async function explainPlan(plan, stats) {
  const fallback = ruleBasedExplanation(plan, stats);
  if (!process.env.ANTHROPIC_API_KEY || plan.length === 0) return fallback;

  const summary = plan
    .map((p) => `- ${p.title} (difficulty ${p.difficulty}, due ${p.deadline.toISOString().slice(0, 10)}): ` +
      p.slots.map((s) => `${s.start.toISOString().slice(0, 16)} [pred focus ${s.score}]`).join(", "))
    .join("\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || "claude-sonnet-4-6",
        max_tokens: 400,
        system:
          "You are a concise study coach. Given a schedule produced by an ANN that predicts the " +
          "student's focus per time slot, explain in under 120 words why the plan is arranged this " +
          "way and give 2 practical tips. Do not invent data.",
        messages: [{
          role: "user",
          content: `ANN trained on ${stats.trainedOn} past sessions.\nPlan:\n${summary}`,
        }],
      }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = await res.json();
    return data.content?.map((c) => c.text || "").join("") || fallback;
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
  return `Tasks are ordered by deadline and each session is placed in the highest-predicted-focus ` +
    `slot available before its due date, ${source}. Harder tasks get your best slots first, and ` +
    `daily sessions are capped to avoid burnout.`;
}
