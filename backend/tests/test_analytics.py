
import mongomock
import pytest

from fastapi import Request
from fastapi.testclient import TestClient

import main
import routes.analytics as analytics_route

from auth import get_current_user


# --------------------------------------------------
# TEST CLIENT AND ISOLATED DATABASE
# --------------------------------------------------

@pytest.fixture
def client(monkeypatch):
    # Create a fresh in-memory database for each test.
    mock_mongo = mongomock.MongoClient()

    transactions = mock_mongo[
        "spendwise_test"
    ]["transactions"]

    # Replace the analytics route's collection.
    # This prevents access to real MongoDB records.
    monkeypatch.setattr(
        analytics_route,
        "transactions_collection",
        transactions,
    )

    def fake_current_user(request: Request):
        user_id = request.headers.get(
            "X-Test-User",
            "user_A",
        )

        request.state.user_id = user_id
        return user_id

    main.app.dependency_overrides[
        get_current_user
    ] = fake_current_user

    try:
        with TestClient(main.app) as test_client:
            yield test_client, transactions
    finally:
        main.app.dependency_overrides.pop(
            get_current_user,
            None,
        )
        mock_mongo.close()


# --------------------------------------------------
# HELPER FUNCTIONS
# --------------------------------------------------

def add_transaction(
    collection,
    amount,
    transaction_type="expense",
    category="Groceries",
    date="2026-11-18",
    user_id="user_A",
):
    collection.insert_one(
        {
            "user_id": user_id,
            "date": date,
            "description": "Test transaction",
            "category": category,
            "type": transaction_type,
            "amount_cents": amount,
        }
    )


def get_analytics(
    client,
    user_id="user_A",
    month="2026-11",
):
    return client.get(
        "/api/analytics",
        params={"month": month},
        headers={"X-Test-User": user_id},
    )


# --------------------------------------------------
# EMPTY FINANCIAL DATA
# --------------------------------------------------

def test_empty_analytics(client):
    api, _ = client

    response = get_analytics(api)

    assert response.status_code == 200

    data = response.json()

    assert data["month"] == "2026-11"
    assert data["income_cents"] == 0
    assert data["expenses_cents"] == 0
    assert data["balance_cents"] == 0
    assert data["savings_rate"] == 0
    assert data["category_breakdown"] == []

    assert len(data["monthly_trend"]) == 6


# --------------------------------------------------
# INCOME, EXPENSES AND BALANCE
# --------------------------------------------------

def test_income_expenses_and_balance(client):
    api, transactions = client

    add_transaction(
        transactions,
        300000,
        transaction_type="income",
    )

    add_transaction(
        transactions,
        50000,
        transaction_type="expense",
    )

    add_transaction(
        transactions,
        25000,
        transaction_type="expense",
    )

    response = get_analytics(api)

    assert response.status_code == 200

    data = response.json()

    assert data["income_cents"] == 300000
    assert data["expenses_cents"] == 75000
    assert data["balance_cents"] == 225000


# --------------------------------------------------
# SAVINGS RATE
# --------------------------------------------------

def test_savings_rate(client):
    api, transactions = client

    # Income: $3,000
    add_transaction(
        transactions,
        300000,
        transaction_type="income",
    )

    # Expenses: $750
    add_transaction(
        transactions,
        75000,
    )

    response = get_analytics(api)
    data = response.json()

    # ($3,000 - $750) / $3,000 * 100 = 75%
    assert data["savings_rate"] == 75.0


def test_zero_income_savings_rate(client):
    api, transactions = client

    add_transaction(
        transactions,
        50000,
        transaction_type="expense",
    )

    response = get_analytics(api)
    data = response.json()

    assert data["income_cents"] == 0
    assert data["expenses_cents"] == 50000
    assert data["balance_cents"] == -50000
    assert data["savings_rate"] == 0


def test_negative_savings_rate(client):
    api, transactions = client

    add_transaction(
        transactions,
        100000,
        transaction_type="income",
    )

    add_transaction(
        transactions,
        150000,
        transaction_type="expense",
    )

    response = get_analytics(api)

    assert response.json()["balance_cents"] == -50000
    assert response.json()["savings_rate"] == -50.0


# --------------------------------------------------
# SIX-MONTH FINANCIAL TREND
# --------------------------------------------------

def test_six_month_trend(client):
    api, transactions = client

    add_transaction(
        transactions,
        100000,
        transaction_type="income",
        date="2026-06-15",
    )

    add_transaction(
        transactions,
        20000,
        transaction_type="expense",
        date="2026-09-10",
    )

    add_transaction(
        transactions,
        50000,
        transaction_type="income",
        date="2026-11-18",
    )

    response = get_analytics(api)

    assert response.status_code == 200

    trend = response.json()["monthly_trend"]

    assert [item["month"] for item in trend] == [
        "2026-06",
        "2026-07",
        "2026-08",
        "2026-09",
        "2026-10",
        "2026-11",
    ]

    assert trend[0]["income_cents"] == 100000
    assert trend[3]["expenses_cents"] == 20000
    assert trend[5]["income_cents"] == 50000


def test_six_month_trend_across_years(client):
    api, transactions = client

    add_transaction(
        transactions,
        80000,
        transaction_type="income",
        date="2025-12-15",
    )

    add_transaction(
        transactions,
        20000,
        transaction_type="expense",
        date="2026-02-10",
    )

    response = get_analytics(
        api,
        month="2026-03",
    )

    assert response.status_code == 200

    trend = response.json()["monthly_trend"]

    assert [item["month"] for item in trend] == [
        "2025-10",
        "2025-11",
        "2025-12",
        "2026-01",
        "2026-02",
        "2026-03",
    ]

    assert trend[2]["income_cents"] == 80000
    assert trend[4]["expenses_cents"] == 20000


# --------------------------------------------------
# CATEGORY SPENDING
# --------------------------------------------------

def test_category_breakdown(client):
    api, transactions = client

    add_transaction(
        transactions,
        30000,
        category="Groceries",
    )

    add_transaction(
        transactions,
        20000,
        category="Groceries",
    )

    add_transaction(
        transactions,
        10000,
        category="Transportation",
    )

    response = get_analytics(api)

    categories = response.json()[
        "category_breakdown"
    ]

    assert categories == [
        {
            "category": "Groceries",
            "amount_cents": 50000,
        },
        {
            "category": "Transportation",
            "amount_cents": 10000,
        },
    ]


def test_category_breakdown_selected_month_only(client):
    api, transactions = client

    add_transaction(
        transactions,
        10000,
        category="Groceries",
        date="2026-11-18",
    )

    add_transaction(
        transactions,
        50000,
        category="Groceries",
        date="2026-10-18",
    )

    response = get_analytics(api)

    categories = response.json()[
        "category_breakdown"
    ]

    assert categories == [
        {
            "category": "Groceries",
            "amount_cents": 10000,
        }
    ]


def test_income_not_in_category_breakdown(client):
    api, transactions = client

    add_transaction(
        transactions,
        300000,
        transaction_type="income",
        category="Other",
    )

    add_transaction(
        transactions,
        25000,
        transaction_type="expense",
        category="Groceries",
    )

    response = get_analytics(api)

    assert response.json()["category_breakdown"] == [
        {
            "category": "Groceries",
            "amount_cents": 25000,
        }
    ]


# --------------------------------------------------
# USER DATA ISOLATION
# --------------------------------------------------

def test_users_have_separate_analytics(client):
    api, transactions = client

    add_transaction(
        transactions,
        300000,
        transaction_type="income",
        user_id="user_A",
    )

    add_transaction(
        transactions,
        50000,
        transaction_type="expense",
        user_id="user_A",
    )

    add_transaction(
        transactions,
        20000,
        transaction_type="expense",
        user_id="user_B",
    )

    response_a = get_analytics(
        api,
        user_id="user_A",
    )

    response_b = get_analytics(
        api,
        user_id="user_B",
    )

    assert response_a.status_code == 200
    assert response_b.status_code == 200

    assert response_a.json()["income_cents"] == 300000
    assert response_a.json()["expenses_cents"] == 50000

    assert response_b.json()["income_cents"] == 0
    assert response_b.json()["expenses_cents"] == 20000


# --------------------------------------------------
# INVALID MONTH
# --------------------------------------------------

@pytest.mark.parametrize(
    "invalid_month",
    [
        "2026-13",
        "2026-00",
        "2026-1",
        "November-2026",
        "invalid",
    ],
)
def test_invalid_month_returns_422(
    client,
    invalid_month,
):
    api, _ = client

    response = get_analytics(
        api,
        month=invalid_month,
    )

    assert response.status_code == 422


def test_missing_month_returns_422(client):
    api, _ = client

    response = api.get(
        "/api/analytics",
        headers={"X-Test-User": "user_A"},
    )

    assert response.status_code == 422
