
from datetime import date
import re

from fastapi import APIRouter, HTTPException

from database import transactions_collection

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


def previous_months(month, count=6):
    year, month_number = map(int, month.split("-"))
    result = []

    for offset in range(count - 1, -1, -1):
        total = year * 12 + month_number - 1 - offset
        y, m = divmod(total, 12)

        result.append(f"{y:04d}-{m + 1:02d}")

    return result


@router.get("")
def get_analytics(month: str):
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month):
        raise HTTPException(
            status_code=422,
            detail="Month must use YYYY-MM"
        )

    months = previous_months(month)

    first_date = f"{months[0]}-01"
    last_date = f"{month}-31"

    documents = transactions_collection.find({
        "date": {
            "$gte": first_date,
            "$lte": last_date
        }
    })

    monthly_totals = {
        m: {"income_cents": 0, "expenses_cents": 0}
        for m in months
    }

    categories = {}

    for transaction in documents:
        transaction_month = transaction["date"][:7]
        transaction_type = transaction["type"]
        amount = transaction["amount_cents"]

        if transaction_type == "income":
            monthly_totals[transaction_month]["income_cents"] += amount
        else:
            monthly_totals[transaction_month]["expenses_cents"] += amount

            if transaction_month == month:
                category = transaction["category"]

                categories[category] = (
                    categories.get(category, 0) + amount
                )

    selected = monthly_totals[month]

    income = selected["income_cents"]
    expenses = selected["expenses_cents"]
    balance = income - expenses

    savings_rate = (
        round(balance / income * 100, 1)
        if income > 0 else 0
    )

    monthly_trend = []

    for m in months:
        totals = monthly_totals[m]

        monthly_trend.append({
            "month": m,
            "income_cents": totals["income_cents"],
            "expenses_cents": totals["expenses_cents"],
        })

    category_breakdown = [
        {
            "category": category,
            "amount_cents": amount
        }
        for category, amount in sorted(
            categories.items(),
            key=lambda item: item[1],
            reverse=True
        )
    ]

    return {
        "month": month,
        "income_cents": income,
        "expenses_cents": expenses,
        "balance_cents": balance,
        "savings_rate": savings_rate,
        "monthly_trend": monthly_trend,
        "category_breakdown": category_breakdown,
    }
