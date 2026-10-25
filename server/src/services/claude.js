import mongoose from "mongoose";
import LlmLog from "../models/LlmLog.js";

/** Single entry point for all Claude calls: auth, error handling, logging. */
export async function claude({ system, messages, tools, toolChoice, maxTokens = 1024, tag = "general" }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const model = process.env.LLM_MODEL || "claude-sonnet-4-6";
  const t0 = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages, tools, tool_choice: toolChoice }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Claude API ${res.status}`);
  if (mongoose.connection.readyState === 1) {
    LlmLog.create({
      tag, model, latencyMs: Date.now() - t0,
      inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens,
      stopReason: data.stop_reason,
    }).catch(() => {});
  }
  return data;
}

export const textOf = (content) => content.filter((b) => b.type === "text").map((b) => b.text).join("");
