
from datetime import date

import pytest
from pydantic import ValidationError

from models import Transaction, Budget, BulkTransactionRequest


# --------------------------------------------------
# TEST DATA
# --------------------------------------------------

def valid_transaction():
    return {
        "date": "2026-11-18",
        "description": "Walmart",
        "category": "Groceries",
        "type": "expense",
        "amount_cents": 8500,
    }


# --------------------------------------------------
# VALID TRANSACTIONS
# --------------------------------------------------

def test_valid_transaction():
    transaction = Transaction(**valid_transaction())

    assert transaction.date == date(2026, 11, 18)
    assert transaction.description == "Walmart"
    assert transaction.category == "Groceries"
    assert transaction.type == "expense"
    assert transaction.amount_cents == 8500


def test_transaction_trims_whitespace():
    data = valid_transaction()
    data["description"] = "  Walmart  "
    data["category"] = "  Groceries  "

    transaction = Transaction(**data)

    assert transaction.description == "Walmart"
    assert transaction.category == "Groceries"


def test_transaction_date_serializes_as_string():
    transaction = Transaction(**valid_transaction())

    document = transaction.model_dump(mode="json")

    assert document["date"] == "2026-11-18"


# --------------------------------------------------
# INVALID TRANSACTION AMOUNTS
# --------------------------------------------------

@pytest.mark.parametrize(
    "amount",
    [
        0,
        -500,
        1_000_000_001,
        19.75,
        "8500",
        True,
    ],
)
def test_invalid_transaction_amount(amount):
    data = valid_transaction()
    data["amount_cents"] = amount

    with pytest.raises(ValidationError):
        Transaction(**data)


# --------------------------------------------------
# INVALID DATES
# --------------------------------------------------

@pytest.mark.parametrize(
    "invalid_date",
    [
        "2026-02-30",
        "18/11/2026",
        "2026-13-01",
        "2026-11-1",
        "not-a-date",
    ],
)
def test_invalid_transaction_date(invalid_date):
    data = valid_transaction()
    data["date"] = invalid_date

    with pytest.raises(ValidationError):
        Transaction(**data)


# --------------------------------------------------
# INVALID DESCRIPTION AND CATEGORY
# --------------------------------------------------

def test_blank_description_is_rejected():
    data = valid_transaction()
    data["description"] = "   "

    with pytest.raises(ValidationError):
        Transaction(**data)


def test_blank_category_is_rejected():
    data = valid_transaction()
    data["category"] = "   "

    with pytest.raises(ValidationError):
        Transaction(**data)


def test_description_over_200_characters_is_rejected():
    data = valid_transaction()
    data["description"] = "A" * 201

    with pytest.raises(ValidationError):
        Transaction(**data)


def test_invalid_transaction_type_is_rejected():
    data = valid_transaction()
    data["type"] = "transfer"

    with pytest.raises(ValidationError):
        Transaction(**data)


def test_unknown_transaction_field_is_rejected():
    data = valid_transaction()
    data["user_id"] = "fake_user"

    with pytest.raises(ValidationError):
        Transaction(**data)


# --------------------------------------------------
# BUDGET TESTS
# --------------------------------------------------

def test_valid_budget():
    budget = Budget(
        category="Groceries",
        limit_cents=50000,
    )

    assert budget.category == "Groceries"
    assert budget.limit_cents == 50000


@pytest.mark.parametrize(
    "invalid_limit",
    [0, -100, 1_000_000_001, 10.5, "50000", True],
)
def test_invalid_budget_limit(invalid_limit):
    with pytest.raises(ValidationError):
        Budget(
            category="Groceries",
            limit_cents=invalid_limit,
        )


def test_invalid_budget_category():
    with pytest.raises(ValidationError):
        Budget(
            category="Unknown Category",
            limit_cents=50000,
        )


# --------------------------------------------------
# CSV BULK IMPORT VALIDATION
# --------------------------------------------------

def test_valid_bulk_import():
    payload = BulkTransactionRequest(
        transactions=[
            valid_transaction(),
            valid_transaction(),
        ]
    )

    assert len(payload.transactions) == 2


def test_empty_bulk_import_is_rejected():
    with pytest.raises(ValidationError):
        BulkTransactionRequest(
            transactions=[]
        )


def test_bulk_import_over_500_is_rejected():
    transactions = [
        valid_transaction()
        for _ in range(501)
    ]

    with pytest.raises(ValidationError):
        BulkTransactionRequest(
            transactions=transactions
        )


def test_bulk_import_rejects_invalid_row():
    valid_row = valid_transaction()

    invalid_row = valid_transaction()
    invalid_row["amount_cents"] = -100

    with pytest.raises(ValidationError):
        BulkTransactionRequest(
            transactions=[
                valid_row,
                invalid_row,
            ]
        )
