
import re
from datetime import date
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


# Maximum amount: $10,000,000.00
# All amounts are stored in cents.
MAX_AMOUNT_CENTS = 1_000_000_000


class Transaction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: date

    description: str = Field(
        min_length=1,
        max_length=200,
        strict=True,
    )

    category: str = Field(
        min_length=1,
        max_length=60,
        strict=True,
    )

    type: Literal["income", "expense"]

    amount_cents: int = Field(
        gt=0,
        le=MAX_AMOUNT_CENTS,
        strict=True,
    )

    @field_validator("date", mode="before")
    @classmethod
    def validate_date(cls, value):
        if not isinstance(value, str):
            raise ValueError(
                "Date must be a string in YYYY-MM-DD format"
            )

        if not re.fullmatch(
            r"\d{4}-\d{2}-\d{2}",
            value,
        ):
            raise ValueError(
                "Date must use YYYY-MM-DD format"
            )

        try:
            return date.fromisoformat(value)
        except ValueError:
            raise ValueError(
                "Date must be a valid calendar date"
            ) from None

    @field_validator(
        "description",
        "category",
        mode="before",
    )
    @classmethod
    def validate_text(cls, value):
        if not isinstance(value, str):
            raise ValueError(
                "Value must be a string"
            )

        cleaned = value.strip()

        if not cleaned:
            raise ValueError(
                "Value cannot be empty or whitespace"
            )

        return cleaned


class BulkTransactionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    transactions: list[Transaction] = Field(
        min_length=1,
        max_length=500,
    )


BudgetCategory = Literal[
    "Groceries",
    "Food & Dining",
    "Entertainment",
    "Transportation",
    "Housing",
    "Utilities",
    "Other",
]


class Budget(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: BudgetCategory

    limit_cents: int = Field(
        gt=0,
        le=MAX_AMOUNT_CENTS,
        strict=True,
    )
