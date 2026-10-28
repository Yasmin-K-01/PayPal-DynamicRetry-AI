# main.py
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Dict, Any

app = FastAPI(title="RetryWise AI Engine")

class RetryRequest(BaseModel):
    transaction_id: str
    failure_reason: str
    previous_recovery: bool = False
    attempt_count: int = 1

class DecisionResponse(BaseModel):
    score: int
    decision: str
    breakdown: Dict[str, int]

@app.post("/api/v1/evaluate", response_model=DecisionResponse)
def evaluate_retry(data: RetryRequest):
    score = 0
    breakdown = {}

    # Rule/Scoring Engine implementation
    reason = data.failure_reason.lower()
    if "network" in reason or "timeout" in reason or "temporary" in reason:
        breakdown["Temporary failure"] = +30
    elif "insufficient" in reason or "balance" in reason:
        breakdown["Insufficient funds"] = -50
    elif "fraud" in reason or "suspicious" in reason:
        breakdown["Suspicious transaction"] = -80
    else:
        breakdown["Generic failure"] = 0

    if data.previous_recovery:
        breakdown["Previous recovery history"] = +20

    if data.attempt_count == 1:
        breakdown["First retry attempt"] = +20
    elif data.attempt_count > 3:
        breakdown["Repeated failures"] = -30

    score = sum(breakdown.values())

    # Map score to action
    if score >= 60:
        decision = "AUTO_RETRY"
    elif 30 <= score < 60:
        decision = "WAIT_ASK_USER"
    else:
        decision = "STOP"

    return {
        "score": score,
        "decision": decision,
        "breakdown": breakdown
    }