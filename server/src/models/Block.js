import mongoose from "mongoose";

/** Time the student is unavailable (sick, exam, travel). Scheduler skips it. */
export default mongoose.model("Block", new mongoose.Schema({
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  reason: String,
}, { timestamps: true }));
