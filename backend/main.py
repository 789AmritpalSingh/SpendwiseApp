
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId
from bson.errors import InvalidId
from pymongo import DESCENDING

from database import (
    client,
    transactions_collection,
    check_database,
)
from models import Transaction, BulkTransactionRequest

app = FastAPI(title="SpendWise API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)


def serialize_transaction(transaction):
    return {
        "id": str(transaction["_id"]),
        "date": transaction["date"],
        "description": transaction["description"],
        "category": transaction["category"],
        "type": transaction["type"],
        "amount_cents": transaction["amount_cents"],
    }


def get_object_id(transaction_id):
    try:
        return ObjectId(transaction_id)
    except (InvalidId, TypeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid transaction ID"
        )


@app.get("/")
def root():
    return {"message": "Welcome to SpendWise API"}


@app.get("/health")
def health():
    try:
        check_database()
        return {
            "api": "online",
            "database": "connected"
        }
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable"
        )


@app.get("/api/transactions")
def get_transactions():
    documents = transactions_collection.find().sort(
        [("date", DESCENDING), ("_id", DESCENDING)]
    )

    return [
        serialize_transaction(doc)
        for doc in documents
    ]


@app.post("/api/transactions/bulk")
def import_transactions(payload: BulkTransactionRequest):
    inserted = 0
    skipped = 0
    seen_in_file = set()

    for transaction in payload.transactions:
        data = transaction.model_dump()
        data["date"] = transaction.date.isoformat()

        # Exact-match duplicate detection.
        fingerprint = (
            data["date"],
            data["description"].strip().casefold(),
            data["category"].strip().casefold(),
            data["type"],
            data["amount_cents"],
        )

        if fingerprint in seen_in_file:
            skipped += 1
            continue

        seen_in_file.add(fingerprint)

        # Check against existing saved transactions.
        existing = transactions_collection.find_one({
            "date": data["date"],
            "description": data["description"],
            "category": data["category"],
            "type": data["type"],
            "amount_cents": data["amount_cents"],
        })

        if existing:
            skipped += 1
            continue

        transactions_collection.insert_one(data)
        inserted += 1

    return {
        "message": "Import completed",
        "inserted": inserted,
        "skipped": skipped,
    }

@app.get("/api/transactions/{transaction_id}")
def get_transaction(transaction_id: str):
    obj_id = get_object_id(transaction_id)

    transaction = transactions_collection.find_one(
        {"_id": obj_id}
    )

    if transaction is None:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )

    return serialize_transaction(transaction)


@app.post("/api/transactions", status_code=201)
def create_transaction(transaction: Transaction):
    data = transaction.model_dump()

    # MongoDB stores the date as an ISO date string.
    data["date"] = transaction.date.isoformat()

    result = transactions_collection.insert_one(data)

    saved = transactions_collection.find_one(
        {"_id": result.inserted_id}
    )

    return serialize_transaction(saved)


@app.put("/api/transactions/{transaction_id}")
def update_transaction(
    transaction_id: str,
    transaction: Transaction
):
    obj_id = get_object_id(transaction_id)

    data = transaction.model_dump()
    data["date"] = transaction.date.isoformat()

    result = transactions_collection.update_one(
        {"_id": obj_id},
        {"$set": data}
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )

    updated = transactions_collection.find_one(
        {"_id": obj_id}
    )

    return serialize_transaction(updated)


@app.delete("/api/transactions/{transaction_id}")
def delete_transaction(transaction_id: str):
    obj_id = get_object_id(transaction_id)

    result = transactions_collection.delete_one(
        {"_id": obj_id}
    )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )

    return {"message": "Transaction deleted successfully"}
