
import re

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from database import transactions_collection


router = APIRouter(
    prefix="/api/analytics",
    tags=["Analytics"],
)


# --------------------------------------------------
# HELPER FUNCTIONS
# --------------------------------------------------

def validate_month(month: str) -> str:
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month):
        raise HTTPException(
            status_code=422,
            detail="Month must use YYYY-MM",
        )

    return month


def previous_months(month: str, count: int = 6) -> list[str]:
    """
    Return the selected month and the preceding
    five months, in chronological order.
    """

    year, month_number = map(int, month.split("-"))

    result = []

    for offset in range(count - 1, -1, -1):
        total = year * 12 + month_number - 1 - offset

        y, m = divmod(total, 12)

        result.append(f"{y:04d}-{m + 1:02d}")

    return result


# --------------------------------------------------
# GET MONTHLY FINANCIAL ANALYTICS
# AUTHENTICATED USER ONLY
# --------------------------------------------------

@router.get("")
def get_analytics(
    month: str,
    user_id: str = Depends(get_current_user),
):
    validate_month(month)

    # Selected month + previous five months.
    months = previous_months(month)

    first_date = f"{months[0]}-01"

    # Inclusive upper bound for the selected month.
    last_date = f"{month}-31"

    # Only read transactions owned by this user.
    documents = transactions_collection.find(
        {
            "user_id": user_id,
            "date": {
                "$gte": first_date,
                "$lte": last_date,
            },
        }
    )

    # --------------------------------------------------
    # INITIALIZE MONTHLY TOTALS
    # --------------------------------------------------

    monthly_totals = {
        current_month: {
            "income_cents": 0,
            "expenses_cents": 0,
        }
        for current_month in months
    }

    categories = {}

    # --------------------------------------------------
    # PROCESS TRANSACTIONS
    # --------------------------------------------------

    for transaction in documents:
        transaction_month = transaction["date"][:7]

        transaction_type = transaction["type"]

        amount = transaction["amount_cents"]

        if transaction_month not in monthly_totals:
            continue

        if transaction_type == "income":
            monthly_totals[transaction_month][
                "income_cents"
            ] += amount

        elif transaction_type == "expense":
            monthly_totals[transaction_month][
                "expenses_cents"
            ] += amount

            # Only calculate categories for the
            # currently selected reporting month.
            if transaction_month == month:
                category = transaction["category"]

                categories[category] = (
                    categories.get(category, 0)
                    + amount
                )

    # --------------------------------------------------
    # SELECTED MONTH SUMMARY
    # --------------------------------------------------

    selected = monthly_totals[month]

    income = selected["income_cents"]
    expenses = selected["expenses_cents"]

    balance = income - expenses

    savings_rate = (
        round((balance / income) * 100, 1)
        if income > 0
        else 0
    )

    # --------------------------------------------------
    # SIX-MONTH FINANCIAL TREND
    # --------------------------------------------------

    monthly_trend = []

    for current_month in months:
        totals = monthly_totals[current_month]

        monthly_trend.append(
            {
                "month": current_month,
                "income_cents": totals["income_cents"],
                "expenses_cents": totals["expenses_cents"],
            }
        )

    # --------------------------------------------------
    # CATEGORY EXPENSE BREAKDOWN
    # --------------------------------------------------

    category_breakdown = [
        {
            "category": category,
            "amount_cents": amount,
        }
        for category, amount in sorted(
            categories.items(),
            key=lambda item: item[1],
            reverse=True,
        )
    ]

    # --------------------------------------------------
    # RETURN ANALYTICS
    # --------------------------------------------------

    return {
        "month": month,
        "income_cents": income,
        "expenses_cents": expenses,
        "balance_cents": balance,
        "savings_rate": savings_rate,
        "monthly_trend": monthly_trend,
        "category_breakdown": category_breakdown,
    }
