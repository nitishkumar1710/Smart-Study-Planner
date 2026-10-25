import mongoose from "mongoose";

const logSchema = new mongoose.Schema(
  {
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
    startedAt: { type: Date, default: Date.now },
    durationMin: { type: Number, default: 60 },
    difficulty: { type: Number, min: 1, max: 5, default: 3 },
    focus: { type: Number, min: 1, max: 5, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("StudyLog", logSchema);
