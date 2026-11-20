
import mongomock
import pytest

from fastapi import Request
from fastapi.testclient import TestClient

import main
from auth import get_current_user


# --------------------------------------------------
# TEST DATA
# --------------------------------------------------

def transaction_data(
    description="Walmart",
    amount_cents=10000,
):
    return {
        "date": "2026-11-18",
        "description": description,
        "category": "Groceries",
        "type": "expense",
        "amount_cents": amount_cents,
    }


# --------------------------------------------------
# ISOLATED TEST CLIENT
# --------------------------------------------------

@pytest.fixture
def client(monkeypatch):
    # A brand-new in-memory database for each test.
    mock_mongo = mongomock.MongoClient()

    test_collection = mock_mongo[
        "spendwise_test"
    ]["transactions"]

    # Replace the collection used by main.py.
    # The real MongoDB collection is not modified.
    monkeypatch.setattr(
        main,
        "transactions_collection",
        test_collection,
    )

    # Test-only authentication override.
    # This does not change production auth.py.
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
            yield test_client
    finally:
        main.app.dependency_overrides.pop(
            get_current_user,
            None,
        )

        mock_mongo.close()


def as_user(client, user_id, method, path, **kwargs):
    headers = kwargs.pop("headers", {})

    return client.request(
        method,
        path,
        headers={
            **headers,
            "X-Test-User": user_id,
        },
        **kwargs,
    )


# --------------------------------------------------
# CREATE TRANSACTION
# --------------------------------------------------

def test_create_transaction(client):
    response = as_user(
        client,
        "user_A",
        "POST",
        "/api/transactions",
        json=transaction_data(),
    )

    assert response.status_code == 201

    data = response.json()

    assert data["description"] == "Walmart"
    assert data["amount_cents"] == 10000
    assert data["date"] == "2026-11-18"
    assert "id" in data


# --------------------------------------------------
# READ TRANSACTIONS
# --------------------------------------------------

def test_get_transactions(client):
    as_user(
        client,
        "user_A",
        "POST",
        "/api/transactions",
        json=transaction_data("Walmart"),
    )

    as_user(
        client,
        "user_A",
        "POST",
        "/api/transactions",
        json=transaction_data("Costco", 5000),
    )

    response = as_user(
        client,
        "user_A",
        "GET",
        "/api/transactions",
    )

    assert response.status_code == 200
    assert len(response.json()) == 2


def test_get_single_transaction(client):
    created = as_user(
        client,
        "user_A",
        "POST",
        "/api/transactions",
        json=transaction_data(),
    ).json()

    response = as_user(
        client,
        "user_A",
        "GET",
        f"/api/transactions/{created['id']}",
    )

    assert response.status_code == 200
    assert response.json()["id"] == created["id"]


# --------------------------------------------------
# UPDATE TRANSACTION
# --------------------------------------------------

def test_update_transaction(client):
    created = as_user(
        client,
        "user_A",
        "POST",
        "/api/transactions",
        json=transaction_data(),
    ).json()

    updated_data = transaction_data(
        "Updated Walmart",
        15000,
    )

    response = as_user(
        client,
        "user_A",
        "PUT",
        f"/api/transactions/{created['id']}",
        json=updated_data,
    )

    assert response.status_code == 200
    assert response.json()["description"] == (
        "Updated Walmart"
    )
    assert response.json()["amount_cents"] == 15000


# --------------------------------------------------
# DELETE TRANSACTION
# --------------------------------------------------

def test_delete_transaction(client):
    created = as_user(
        client,
        "user_A",
        "POST",
        "/api/transactions",
        json=transaction_data(),
    ).json()

    transaction_id = created["id"]

    response = as_user(
        client,
        "user_A",
        "DELETE",
        f"/api/transactions/{transaction_id}",
    )

    assert response.status_code == 200

    check = as_user(
        client,
        "user_A",
        "GET",
        f"/api/transactions/{transaction_id}",
    )

    assert check.status_code == 404


# --------------------------------------------------
# USER ISOLATION
# --------------------------------------------------

def test_user_b_cannot_see_user_a_transactions(client):
    as_user(
        client,
        "user_A",
        "POST",
        "/api/transactions",
        json=transaction_data(),
    )

    response = as_user(
        client,
        "user_B",
        "GET",
        "/api/transactions",
    )

    assert response.status_code == 200
    assert response.json() == []


def test_user_b_cannot_edit_user_a_transaction(client):
    created = as_user(
        client,
        "user_A",
        "POST",
        "/api/transactions",
        json=transaction_data(),
    ).json()

    response = as_user(
        client,
        "user_B",
        "PUT",
        f"/api/transactions/{created['id']}",
        json=transaction_data(
            "Unauthorized Change",
            99999,
        ),
    )

    assert response.status_code == 404

    original = as_user(
        client,
        "user_A",
        "GET",
        f"/api/transactions/{created['id']}",
    )

    assert original.status_code == 200
    assert original.json()["description"] == "Walmart"
    assert original.json()["amount_cents"] == 10000


def test_user_b_cannot_delete_user_a_transaction(client):
    created = as_user(
        client,
        "user_A",
        "POST",
        "/api/transactions",
        json=transaction_data(),
    ).json()

    response = as_user(
        client,
        "user_B",
        "DELETE",
        f"/api/transactions/{created['id']}",
    )

    assert response.status_code == 404

    original = as_user(
        client,
        "user_A",
        "GET",
        f"/api/transactions/{created['id']}",
    )

    assert original.status_code == 200


# --------------------------------------------------
# INPUT VALIDATION AND INVALID IDs
# --------------------------------------------------

def test_negative_amount_returns_422(client):
    response = as_user(
        client,
        "user_A",
        "POST",
        "/api/transactions",
        json=transaction_data(
            "Invalid Expense",
            -100,
        ),
    )

    assert response.status_code == 422


def test_invalid_transaction_id_returns_400(client):
    response = as_user(
        client,
        "user_A",
        "GET",
        "/api/transactions/not-a-valid-id",
    )

    assert response.status_code == 400


# --------------------------------------------------
# CSV DUPLICATE DETECTION
# --------------------------------------------------

def test_csv_import_preserves_identical_purchases(client):
    row = transaction_data(
        "FreshCo",
        3275,
    )

    response = as_user(
        client,
        "user_A",
        "POST",
        "/api/transactions/bulk",
        json={
            "transactions": [
                row,
                row.copy(),
            ]
        },
    )

    assert response.status_code == 200
    assert response.json()["inserted"] == 2
    assert response.json()["skipped"] == 0

    transactions = as_user(
        client,
        "user_A",
        "GET",
        "/api/transactions",
    ).json()

    assert len(transactions) == 2


def test_reimport_same_csv_skips_existing_rows(client):
    rows = [
        transaction_data("FreshCo", 3275),
        transaction_data("Costco", 5000),
    ]

    first = as_user(
        client,
        "user_A",
        "POST",
        "/api/transactions/bulk",
        json={"transactions": rows},
    )

    second = as_user(
        client,
        "user_A",
        "POST",
        "/api/transactions/bulk",
        json={"transactions": rows},
    )

    assert first.status_code == 200
    assert first.json()["inserted"] == 2

    assert second.status_code == 200
    assert second.json()["inserted"] == 0
    assert second.json()["skipped"] == 2
