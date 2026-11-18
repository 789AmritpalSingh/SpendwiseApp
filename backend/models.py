
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, ConfigDict


class Transaction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: date

    description: str = Field(
        min_length=1,
        max_length=200
    )

    category: str = Field(
        min_length=1,
        max_length=60
    )

    type: Literal["income", "expense"]

    amount_cents: int = Field(gt=0)


class BulkTransactionRequest(BaseModel):
    transactions: list[Transaction] = Field(
        min_length=1,
        max_length=500
    )

BudgetCategory = Literal[
    "Groceries",
    "Food & Dining",
    "Entertainment",
    "Transportation",
    "Housing",
    "Utilities",
    "Other"
]

class Budget(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: BudgetCategory
    limit_cents: int = Field(gt=0)