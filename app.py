import math

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


app = FastAPI(
    title="QuantumCalculator API",
    description="A calculator API for basic arithmetic operations.",
    version="1.0.0",
)


class CalculationRequest(BaseModel):
    a: float = Field(allow_inf_nan=False)
    b: float = Field(allow_inf_nan=False)
    operation: str


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/calculate")
def calculate(data: CalculationRequest):
    a = data.a
    b = data.b
    operation = data.operation

    if operation == "add":
        result = a + b

    elif operation == "subtract":
        result = a - b

    elif operation == "multiply":
        result = a * b

    elif operation == "divide":
        if b == 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot divide by zero.",
            )
        result = a / b

    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported operation.",
        )

    if not math.isfinite(result):
        raise HTTPException(
            status_code=400,
            detail="Result is outside the supported numeric range.",
        )

    return {
        "result": result,
        "operation": operation,
    }
