
import mongomock
import pytest

from fastapi import Request
from fastapi.testclient import TestClient

import main
import routes.budgets as budgets_route

from auth import get_current_user


@pytest.fixture
def client(monkeypatch):
    # Fresh, in-memory database for every test.
    mock_mongo = mongomock.MongoClient()
    db = mock_mongo["spendwise_test"]

    transactions = db["transactions"]
    budgets = db["budgets"]

    monkeypatch.setattr(
        budgets_route,
        "transactions_collection",
        transactions,
    )

    monkeypatch.setattr(
        budgets_route,
        "budgets_collection",
        budgets,
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
            yield test_client, transactions, budgets
    finally:
        main.app.dependency_overrides.pop(
            get_current_user,
            None,
        )
        mock_mongo.close()


def as_user(
    client,
    user_id,
    method,
    path,
    **kwargs,
):
    return client.request(
        method,
        path,
        headers={"X-Test-User": user_id},
        **kwargs,
    )


def save_budget(
    client,
    user_id="user_A",
    month="2026-11",
    limit_cents=50000,
):
    return as_user(
        client,
        user_id,
        "PUT",
        f"/api/budgets/{month}",
        json={
            "category": "Groceries",
            "limit_cents": limit_cents,
        },
    )


def add_expense(
    collection,
    amount,
    user_id="user_A",
    date="2026-11-18",
    transaction_type="expense",
):
    collection.insert_one(
        {
            "user_id": user_id,
            "date": date,
            "description": "Walmart",
            "category": "Groceries",
            "type": transaction_type,
            "amount_cents": amount,
        }
    )


# --------------------------------------------------
# BUDGET CRUD
# --------------------------------------------------

def test_empty_budgets(client):
    api, _, _ = client

    response = api.get("/api/budgets/2026-11")

    assert response.status_code == 200
    assert response.json() == []


def test_create_budget(client):
    api, _, _ = client

    response = save_budget(api)

    assert response.status_code == 200
    data = response.json()

    assert data["category"] == "Groceries"
    assert data["limit_cents"] == 50000
    assert data["spent_cents"] == 0
    assert data["remaining_cents"] == 50000
    assert data["status"] == "on_track"


def test_update_existing_budget(client):
    api, _, budgets = client

    save_budget(api, limit_cents=50000)
    response = save_budget(api, limit_cents=70000)

    assert response.status_code == 200
    assert response.json()["limit_cents"] == 70000

    assert budgets.count_documents({
        "user_id": "user_A",
        "month": "2026-11",
        "category": "Groceries",
    }) == 1


# --------------------------------------------------
# SPENDING CALCULATIONS
# --------------------------------------------------

def test_budget_calculates_spending(client):
    api, transactions, _ = client

    add_expense(transactions, 6000)
    add_expense(transactions, 4000)

    response = save_budget(api)

    data = response.json()

    assert data["spent_cents"] == 10000
    assert data["remaining_cents"] == 40000
    assert data["percentage"] == 20.0
    assert data["status"] == "on_track"


def test_income_does_not_count_as_spending(client):
    api, transactions, _ = client

    add_expense(transactions, 10000)
    add_expense(
        transactions,
        20000,
        transaction_type="income",
    )

    response = save_budget(api)

    assert response.json()["spent_cents"] == 10000


def test_budget_warning_at_80_percent(client):
    api, transactions, _ = client

    add_expense(transactions, 40000)

    response = save_budget(api)

    assert response.json()["percentage"] == 80.0
    assert response.json()["status"] == "warning"


def test_budget_exceeded_at_100_percent(client):
    api, transactions, _ = client

    add_expense(transactions, 60000)

    response = save_budget(api)

    assert response.json()["percentage"] == 120.0
    assert response.json()["status"] == "exceeded"
    assert response.json()["remaining_cents"] == -10000


def test_other_month_expenses_are_excluded(client):
    api, transactions, _ = client

    add_expense(
        transactions,
        10000,
        date="2026-11-18",
    )
    add_expense(
        transactions,
        20000,
        date="2026-12-18",
    )

    response = save_budget(api)

    assert response.json()["spent_cents"] == 10000


# --------------------------------------------------
# USER ISOLATION
# --------------------------------------------------

def test_users_have_independent_budgets(client):
    api, transactions, _ = client

    add_expense(
        transactions,
        10000,
        user_id="user_A",
    )

    a = save_budget(
        api,
        user_id="user_A",
        limit_cents=50000,
    )

    b = save_budget(
        api,
        user_id="user_B",
        limit_cents=70000,
    )

    assert a.status_code == 200
    assert b.status_code == 200

    assert a.json()["spent_cents"] == 10000
    assert b.json()["spent_cents"] == 0

    assert a.json()["limit_cents"] == 50000
    assert b.json()["limit_cents"] == 70000


def test_user_b_cannot_delete_user_a_budget(client):
    api, _, _ = client

    save_budget(api, user_id="user_A")

    response = as_user(
        api,
        "user_B",
        "DELETE",
        "/api/budgets/2026-11/Groceries",
    )

    assert response.status_code == 404

    original = as_user(
        api,
        "user_A",
        "GET",
        "/api/budgets/2026-11",
    )

    assert len(original.json()) == 1


# --------------------------------------------------
# VALIDATION
# --------------------------------------------------

def test_invalid_month_is_rejected(client):
    api, _, _ = client

    response = api.get(
        "/api/budgets/2026-13"
    )

    assert response.status_code == 422


def test_invalid_budget_limit_is_rejected(client):
    api, _, _ = client

    response = save_budget(
        api,
        limit_cents=-500,
    )

    assert response.status_code == 422
