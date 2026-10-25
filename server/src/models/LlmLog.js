import mongoose from "mongoose";

/** Observability: every LLM call is recorded (latency, tokens, tag). */
export default mongoose.model("LlmLog", new mongoose.Schema({
  tag: String, model: String, latencyMs: Number,
  inputTokens: Number, outputTokens: Number, stopReason: String,
}, { timestamps: true }));
