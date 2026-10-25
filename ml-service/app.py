"""Habit-learning ANN service.

Learns, per user, how focused they tend to be at a given hour / weekday /
task difficulty, then scores candidate study slots. Cold-start is handled with
a synthetic "typical student" prior that real logs gradually override.
"""
import math
from typing import List

import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel
from sklearn.neural_network import MLPRegressor

app = FastAPI(title="Study Planner ML Service")
_cache: dict = {}  # user_id -> (n_logs, model)


class Log(BaseModel):
    hour: int
    dow: int
    difficulty: int
    focus: float  # 1-5 self-reported


class Slot(BaseModel):
    id: str
    hour: int
    dow: int


class RankRequest(BaseModel):
    user_id: str = "default"
    logs: List[Log] = []
    difficulty: int = 3
    slots: List[Slot]


def features(hour: int, dow: int, difficulty: int):
    return [
        math.sin(2 * math.pi * hour / 24), math.cos(2 * math.pi * hour / 24),
        math.sin(2 * math.pi * dow / 7), math.cos(2 * math.pi * dow / 7),
        difficulty / 5.0,
    ]


def prior_dataset(n=300, seed=0):
    rng = np.random.default_rng(seed)
    X, y = [], []
    for _ in range(n):
        h, d, diff = int(rng.integers(0, 24)), int(rng.integers(0, 7)), int(rng.integers(1, 6))
        f = 2.0 + 1.6 * math.exp(-((h - 10) / 3) ** 2) + 1.2 * math.exp(-((h - 20) / 2.5) ** 2)
        if h >= 23 or h < 6:
            f -= 1.0 + 0.4 * diff / 5
        if d >= 5:
            f -= 0.2
        X.append(features(h, d, diff))
        y.append(float(np.clip(f + rng.normal(0, 0.2), 1, 5)))
    return X, y


def train(logs: List[Log]) -> MLPRegressor:
    X, y = prior_dataset()
    for l in logs:  # user data repeated so it outweighs the prior
        for _ in range(5):
            X.append(features(l.hour, l.dow, l.difficulty))
            y.append(l.focus)
    model = MLPRegressor(hidden_layer_sizes=(16, 8), activation="tanh",
                         max_iter=1500, random_state=42)
    model.fit(np.array(X), np.array(y))
    return model


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/rank")
def rank(req: RankRequest):
    cached = _cache.get(req.user_id)
    if cached is None or cached[0] != len(req.logs):
        cached = (len(req.logs), train(req.logs))
        _cache[req.user_id] = cached
    model = cached[1]
    if not req.slots:
        return {"trained_on": len(req.logs), "scores": []}
    X = np.array([features(s.hour, s.dow, req.difficulty) for s in req.slots])
    preds = np.clip(model.predict(X), 1, 5)
    return {
        "trained_on": len(req.logs),
        "scores": [{"id": s.id, "score": round(float(p), 3)} for s, p in zip(req.slots, preds)],
    }
