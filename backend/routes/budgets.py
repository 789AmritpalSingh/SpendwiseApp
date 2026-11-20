
import re

from fastapi import APIRouter, Depends, HTTPException
from pymongo import ASCENDING

from auth import get_current_user
from database import db, transactions_collection
from models import Budget


router = APIRouter(
    prefix="/api/budgets",
    tags=["Budgets"],
)

budgets_collection = db["budgets"]


# --------------------------------------------------
# HELPER FUNCTIONS
# --------------------------------------------------

def validate_month(month: str) -> str:
    if not re.fullmatch(
        r"\d{4}-(0[1-9]|1[0-2])",
        month,
    ):
        raise HTTPException(
            status_code=422,
            detail="Month must use YYYY-MM",
        )

    return month


def calculate_spending(month: str, user_id: str) -> dict:
    """
    Calculate expenses by category for one
    authenticated user and selected month.
    """

    transactions = transactions_collection.find(
        {
            "user_id": user_id,
            "date": {"$regex": f"^{month}-"},
            "type": "expense",
        }
    )

    spending = {}

    for transaction in transactions:
        category = transaction["category"]
        amount = transaction["amount_cents"]

        spending[category] = (
            spending.get(category, 0) + amount
        )

    return spending


def serialize_budget(document: dict, spending: dict) -> dict:
    category = document["category"]

    limit = document["limit_cents"]
    spent = spending.get(category, 0)

    percentage = round(
        (spent / limit) * 100,
        1,
    )

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


# --------------------------------------------------
# GET BUDGETS FOR A SELECTED MONTH
# --------------------------------------------------

@router.get("/{month}")
def get_budgets(
    month: str,
    user_id: str = Depends(get_current_user),
):
    validate_month(month)

    spending = calculate_spending(
        month,
        user_id,
    )

    documents = budgets_collection.find(
        {
            "user_id": user_id,
            "month": month,
        }
    ).sort(
        "category",
        ASCENDING,
    )

    return [
        serialize_budget(document, spending)
        for document in documents
    ]


# --------------------------------------------------
# CREATE OR UPDATE A MONTHLY BUDGET
# --------------------------------------------------

@router.put("/{month}")
def save_budget(
    month: str,
    budget: Budget,
    user_id: str = Depends(get_current_user),
):
    validate_month(month)

    # The unique index is managed by setup_indexes.py.
    # Each user has one budget per category/month.

    filter_query = {
        "user_id": user_id,
        "month": month,
        "category": budget.category,
    }

    budgets_collection.update_one(
        filter_query,
        {
            "$set": {
                "limit_cents": budget.limit_cents,
            }
        },
        upsert=True,
    )

    saved = budgets_collection.find_one(
        filter_query
    )

    spending = calculate_spending(
        month,
        user_id,
    )

    return serialize_budget(
        saved,
        spending,
    )


# --------------------------------------------------
# DELETE A MONTHLY BUDGET
# --------------------------------------------------

@router.delete("/{month}/{category}")
def delete_budget(
    month: str,
    category: str,
    user_id: str = Depends(get_current_user),
):
    validate_month(month)

    result = budgets_collection.delete_one(
        {
            "user_id": user_id,
            "month": month,
            "category": category,
        }
    )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Budget not found",
        )

    return {
        "message": "Budget deleted successfully",
    }
