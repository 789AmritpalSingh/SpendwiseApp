
from types import SimpleNamespace

import mongomock
import pytest

from fastapi.testclient import TestClient

import auth
import main


@pytest.fixture
def auth_client(monkeypatch):
    mock_mongo = mongomock.MongoClient()
    collection = mock_mongo["spendwise_test"]["transactions"]

    monkeypatch.setattr(
        main,
        "transactions_collection",
        collection,
    )

    # Simulate Clerk's result after verifying a token.
    # Never accept user identity from an HTTP header.
    def fake_authenticate(request, options):
        authorization = request.headers.get(
            "authorization",
            "",
        )

        users = {
            "Bearer test-token-A": "user_A",
            "Bearer test-token-B": "user_B",
        }

        user_id = users.get(authorization)

        return SimpleNamespace(
            is_signed_in=user_id is not None,
            payload=(
                {"sub": user_id}
                if user_id
                else None
            ),
        )

    monkeypatch.setattr(
        auth,
        "authenticate_request",
        fake_authenticate,
    )

    with TestClient(main.app) as client:
        yield client, collection

    mock_mongo.close()


def headers_for(user):
    return {
        "Authorization": f"Bearer test-token-{user}",
    }


def test_missing_token_returns_401(auth_client):
    client, _ = auth_client

    response = client.get("/api/transactions")

    assert response.status_code == 401


def test_invalid_token_returns_401(auth_client):
    client, _ = auth_client

    response = client.get(
        "/api/transactions",
        headers={
            "Authorization": "Bearer invalid-token"
        },
    )

    assert response.status_code == 401


def test_valid_authenticated_request(auth_client):
    client, _ = auth_client

    response = client.get(
        "/api/transactions",
        headers=headers_for("A"),
    )

    assert response.status_code == 200
    assert response.json() == []


def test_user_id_cannot_be_spoofed(auth_client):
    client, collection = auth_client

    response = client.post(
        "/api/transactions",
        headers={
            **headers_for("A"),
            "X-Test-User": "user_B",
        },
        json={
            "date": "2026-11-18",
            "description": "Walmart",
            "category": "Groceries",
            "type": "expense",
            "amount_cents": 10000,
        },
    )

    assert response.status_code == 201

    saved = collection.find_one({
        "description": "Walmart"
    })

    assert saved is not None
    assert saved["user_id"] == "user_A"


def test_other_user_cannot_access_transaction(
    auth_client,
):
    client, _ = auth_client

    created = client.post(
        "/api/transactions",
        headers=headers_for("A"),
        json={
            "date": "2026-11-18",
            "description": "Private Expense",
            "category": "Other",
            "type": "expense",
            "amount_cents": 2500,
        },
    )

    assert created.status_code == 201

    transaction_id = created.json()["id"]

    # The owner can access the transaction.
    owner_response = client.get(
        f"/api/transactions/{transaction_id}",
        headers=headers_for("A"),
    )

    assert owner_response.status_code == 200

    # A different authenticated user cannot.
    other_response = client.get(
        f"/api/transactions/{transaction_id}",
        headers=headers_for("B"),
    )

    assert other_response.status_code == 404
