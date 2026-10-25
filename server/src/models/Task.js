import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subject: { type: String, default: "General" },
    difficulty: { type: Number, min: 1, max: 5, default: 3 },
    estimatedMinutes: { type: Number, min: 15, default: 60 },
    deadline: { type: Date, required: true },
    completed: { type: Boolean, default: false },
    slots: [{ start: Date, end: Date, score: Number }],
  },
  { timestamps: true }
);

export default mongoose.model("Task", taskSchema);
