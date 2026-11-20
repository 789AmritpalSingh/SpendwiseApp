
from uuid import uuid4

import mongomock
import pytest

from fastapi import Request
from fastapi.testclient import TestClient

import main
from auth import get_current_user


# --------------------------------------------------
# ISOLATED TEST ENVIRONMENT
# --------------------------------------------------

@pytest.fixture
def test_environment(monkeypatch):
    mock_mongo = mongomock.MongoClient()

    transactions = mock_mongo[
        "spendwise_test"
    ]["transactions"]

    # Never write to the real MongoDB collection.
    monkeypatch.setattr(
        main,
        "transactions_collection",
        transactions,
    )

    # Unique user IDs prevent rate-limit counts
    # from affecting unrelated tests.
    user_a = f"test_user_{uuid4().hex}"
    user_b = f"test_user_{uuid4().hex}"

    def fake_current_user(request: Request):
        user_id = request.headers.get(
            "X-Test-User",
            user_a,
        )
        request.state.user_id = user_id
        return user_id

    main.app.dependency_overrides[
        get_current_user
    ] = fake_current_user

    try:
        with TestClient(main.app) as client:
            yield client, transactions, user_a, user_b
    finally:
        main.app.dependency_overrides.pop(
            get_current_user,
            None,
        )
        mock_mongo.close()


def sample_row(
    description="Walmart",
    amount=2500,
):
    return {
        "date": "2026-11-18",
        "description": description,
        "category": "Groceries",
        "type": "expense",
        "amount_cents": amount,
    }


def import_rows(client, user_id, rows):
    return client.post(
        "/api/transactions/bulk",
        headers={
            "X-Test-User": user_id,
        },
        json={
            "transactions": rows,
        },
    )


# --------------------------------------------------
# CSV IMPORT TESTS
# --------------------------------------------------

def test_first_csv_import(test_environment):
    client, collection, user_a, _ = test_environment

    rows = [
        sample_row("Walmart", 2500),
        sample_row("Costco", 5000),
    ]

    response = import_rows(
        client,
        user_a,
        rows,
    )

    assert response.status_code == 200
    assert response.json()["inserted"] == 2
    assert response.json()["skipped"] == 0

    assert collection.count_documents({
        "user_id": user_a
    }) == 2


def test_identical_purchases_are_preserved(
    test_environment,
):
    client, collection, user_a, _ = test_environment

    row = sample_row("FreshCo", 3275)

    response = import_rows(
        client,
        user_a,
        [row, row.copy()],
    )

    assert response.status_code == 200
    assert response.json()["inserted"] == 2

    saved = list(collection.find({
        "user_id": user_a,
        "description": "FreshCo",
    }))

    assert len(saved) == 2

    # Each row has a distinct position.
    assert {
        doc["import_row_index"]
        for doc in saved
    } == {0, 1}


def test_reimport_skips_existing_rows(
    test_environment,
):
    client, collection, user_a, _ = test_environment

    rows = [
        sample_row("Walmart", 2500),
        sample_row("Costco", 5000),
    ]

    first = import_rows(client, user_a, rows)
    second = import_rows(client, user_a, rows)

    assert first.status_code == 200
    assert second.status_code == 200

    assert first.json()["inserted"] == 2
    assert second.json()["inserted"] == 0
    assert second.json()["skipped"] == 2

    assert collection.count_documents({
        "user_id": user_a
    }) == 2


def test_users_can_import_same_csv(
    test_environment,
):
    client, collection, user_a, user_b = (
        test_environment
    )

    rows = [
        sample_row("Walmart", 2500),
    ]

    response_a = import_rows(
        client,
        user_a,
        rows,
    )

    response_b = import_rows(
        client,
        user_b,
        rows,
    )

    assert response_a.status_code == 200
    assert response_b.status_code == 200

    assert response_a.json()["inserted"] == 1
    assert response_b.json()["inserted"] == 1

    assert collection.count_documents({
        "user_id": user_a,
    }) == 1

    assert collection.count_documents({
        "user_id": user_b,
    }) == 1


def test_modified_batch_is_new_import(
    test_environment,
):
    client, collection, user_a, _ = test_environment

    first_rows = [
        sample_row("Walmart", 2500),
    ]

    changed_rows = [
        sample_row("Walmart", 2500),
        sample_row("Costco", 5000),
    ]

    first = import_rows(
        client,
        user_a,
        first_rows,
    )

    second = import_rows(
        client,
        user_a,
        changed_rows,
    )

    assert first.status_code == 200
    assert second.status_code == 200

    assert first.json()["inserted"] == 1
    assert second.json()["inserted"] == 2

    assert collection.count_documents({
        "user_id": user_a,
    }) == 3


# --------------------------------------------------
# RATE LIMITING
# --------------------------------------------------

def test_csv_rate_limit_returns_429(
    test_environment,
):
    client, collection, user_a, _ = test_environment

    row = sample_row("Rate Limit Test", 100)

    # Current CSV limit: 10 requests per minute.
    for _ in range(10):
        response = import_rows(
            client,
            user_a,
            [row],
        )

        assert response.status_code == 200

    # The 11th request should be blocked.
    blocked = import_rows(
        client,
        user_a,
        [row],
    )

    assert blocked.status_code == 429

    # Rate limiting should not create extra records.
    assert collection.count_documents({
        "user_id": user_a,
    }) == 1


def test_rate_limits_are_separate_per_user(
    test_environment,
):
    client, _, user_a, user_b = test_environment

    row = sample_row("Independent Limit", 200)

    for _ in range(10):
        response = import_rows(
            client,
            user_a,
            [row],
        )
        assert response.status_code == 200

    blocked_a = import_rows(
        client,
        user_a,
        [row],
    )

    assert blocked_a.status_code == 429

    # User B must have their own request allowance.
    response_b = import_rows(
        client,
        user_b,
        [row],
    )

    assert response_b.status_code == 200
    assert response_b.json()["inserted"] == 1
