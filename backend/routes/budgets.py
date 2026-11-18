
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from pymongo import ASCENDING

from database import db, transactions_collection
from models import Budget

router = APIRouter(prefix="/api/budgets", tags=["Budgets"])

budgets_collection = db["budgets"]


class BudgetPeriod(BaseModel):
    month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")


def validate_month(month):
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month):
        raise HTTPException(
            status_code=422,
            detail="Month must use YYYY-MM"
        )
    return month


def calculate_spending(month):
    rows = transactions_collection.find({
        "date": {"$regex": f"^{month}-"},
        "type": "expense",
    })

    spending = {}

    for row in rows:
        category = row["category"]
        spending[category] = (
            spending.get(category, 0) + row["amount_cents"]
        )

    return spending


def serialize_budget(document, spending):
    category = document["category"]
    limit = document["limit_cents"]
    spent = spending.get(category, 0)

    percentage = round(spent / limit * 100, 1)

    if percentage >= 100:
        status = "exceeded"
    elif percentage >= 80:
        status = "warning"
    else:
        status = "on_track"

    return {
        "id": str(document["_id"]),
        "month": document["month"],
        "category": category,
        "limit_cents": limit,
        "spent_cents": spent,
        "remaining_cents": limit - spent,
        "percentage": percentage,
        "status": status,
    }


@router.get("/{month}")
def get_budgets(month: str):
    validate_month(month)

    spending = calculate_spending(month)

    documents = budgets_collection.find(
        {"month": month}
    ).sort("category", ASCENDING)

    return [
        serialize_budget(doc, spending)
        for doc in documents
    ]


@router.put("/{month}")
def save_budget(month: str, budget: Budget):
    validate_month(month)

    budgets_collection.create_index(
        [("month", ASCENDING), ("category", ASCENDING)],
        unique=True
    )

    budgets_collection.update_one(
        {
            "month": month,
            "category": budget.category,
        },
        {
            "$set": {
                "limit_cents": budget.limit_cents
            }
        },
        upsert=True
    )

    saved = budgets_collection.find_one({
        "month": month,
        "category": budget.category,
    })

    spending = calculate_spending(month)

    return serialize_budget(saved, spending)


@router.delete("/{month}/{category}")
def delete_budget(month: str, category: str):
    validate_month(month)

    result = budgets_collection.delete_one({
        "month": month,
        "category": category,
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Budget not found"
        )

    return {"message": "Budget deleted successfully"}
