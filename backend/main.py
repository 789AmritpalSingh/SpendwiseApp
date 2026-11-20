
import logging
import hashlib
import json
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from bson import ObjectId
from slowapi.errors import RateLimitExceeded
from rate_limit import limiter
from bson.errors import InvalidId
from pymongo import DESCENDING
from pymongo.errors import DuplicateKeyError, PyMongoError

from routes.budgets import router as budgets_router
from routes.analytics import router as analytics_router

from auth import get_current_user

from database import (
    transactions_collection,
    check_database,
)

from models import Transaction, BulkTransactionRequest


# --------------------------------------------------
# LOGGING
# --------------------------------------------------

logger = logging.getLogger("spendwise.api")


# --------------------------------------------------
# FASTAPI APPLICATION
# --------------------------------------------------

app = FastAPI(
    title="SpendWise API",
    version="1.0.0",
    description="Personal Finance Management API",
)

# --------------------------------------------------
# RATE LIMITING
# --------------------------------------------------

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_exceeded_handler(
    request: Request,
    exc: RateLimitExceeded,
):
    return JSONResponse(
        status_code=429,
        content={
            "detail": (
                "Too many requests. "
                "Please try again later."
            )
        },
    )

# --------------------------------------------------
# CORS CONFIGURATION
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://spendwise-app-ten.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# DATABASE ERROR HANDLING
# --------------------------------------------------

@app.exception_handler(DuplicateKeyError)
async def handle_duplicate_key(request, exc):
    logger.warning(
        "Database unique constraint conflict on %s",
        request.url.path,
    )

    return JSONResponse(
        status_code=409,
        content={
            "detail": (
                "A conflicting record already exists."
            )
        },
    )


@app.exception_handler(PyMongoError)
async def handle_database_error(request, exc):
    logger.error(
        "Database operation failed on %s",
        request.url.path,
        exc_info=True,
    )

    return JSONResponse(
        status_code=503,
        content={
            "detail": (
                "Database temporarily unavailable. "
                "Please try again."
            )
        },
    )


# --------------------------------------------------
# REGISTER ROUTERS
# --------------------------------------------------

app.include_router(budgets_router)
app.include_router(analytics_router)


# --------------------------------------------------
# HELPER FUNCTIONS
# --------------------------------------------------

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
            detail="Invalid transaction ID",
        ) from None


# --------------------------------------------------
# PUBLIC ENDPOINTS
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "message": "Welcome to SpendWise API",
        "version": "1.0.0",
    }


@app.get("/health")
def health():
    try:
        check_database()

        return {
            "api": "online",
            "database": "connected",
        }

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable",
        ) from None


# --------------------------------------------------
# GET ALL TRANSACTIONS
# AUTHENTICATED USER ONLY
# --------------------------------------------------

@app.get("/api/transactions")
@limiter.limit("120/minute")
def get_transactions(
    request: Request,
    user_id: str = Depends(get_current_user),
):
    documents = transactions_collection.find(
        {
            "user_id": user_id,
        }
    ).sort(
        [
            ("date", DESCENDING),
            ("_id", DESCENDING),
        ]
    )

    return [
        serialize_transaction(doc)
        for doc in documents
    ]


# --------------------------------------------------
# BULK IMPORT TRANSACTIONS
# AUTHENTICATED USER ONLY
# --------------------------------------------------


@app.post("/api/transactions/bulk")
@limiter.limit("10/minute")
def import_transactions(
    request: Request,
    payload: BulkTransactionRequest,
    user_id: str = Depends(get_current_user),
):
    # Convert validated Pydantic models into JSON-compatible
    # documents. Dates remain YYYY-MM-DD strings.
    documents = [
        transaction.model_dump(mode="json")
        for transaction in payload.transactions
    ]

    # Hash the validated batch, preserving row order and
    # repeated transactions.
    batch_content = json.dumps(
        documents,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )

    batch_id = hashlib.sha256(
        batch_content.encode("utf-8")
    ).hexdigest()

    inserted = 0
    skipped = 0

    for row_index, document in enumerate(documents):
        # Ownership always comes from the verified Clerk
        # session, never from the CSV or frontend.
        document["user_id"] = user_id

        # Identify the original import batch and row.
        document["import_batch_id"] = batch_id
        document["import_row_index"] = row_index

        # An existing row in the same batch is skipped.
        # Repeated purchase rows within a new batch remain
        # separate because each has a different row_index.
        filter_query = {
            "user_id": user_id,
            "import_batch_id": batch_id,
            "import_row_index": row_index,
        }

        result = transactions_collection.update_one(
            filter_query,
            {
                "$setOnInsert": document,
            },
            upsert=True,
        )

        if result.upserted_id is not None:
            inserted += 1
        else:
            skipped += 1

    return {
        "message": "Import completed",
        "inserted": inserted,
        "skipped": skipped,
    }


# --------------------------------------------------
# GET SINGLE TRANSACTION
# AUTHENTICATED USER ONLY
# --------------------------------------------------

@app.get("/api/transactions/{transaction_id}")
@limiter.limit("120/minute")
def get_transaction(
    request: Request,
    transaction_id: str,
    user_id: str = Depends(get_current_user),
):
    obj_id = get_object_id(transaction_id)

    transaction = transactions_collection.find_one(
        {
            "_id": obj_id,
            "user_id": user_id,
        }
    )

    if transaction is None:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found",
        )

    return serialize_transaction(transaction)


# --------------------------------------------------
# CREATE TRANSACTION
# AUTHENTICATED USER ONLY
# --------------------------------------------------

@app.post("/api/transactions", status_code=201)
@limiter.limit("60/minute")
def create_transaction(
    request: Request,
    transaction: Transaction,
    user_id: str = Depends(get_current_user),
):
    data = transaction.model_dump(
        mode="json"
    )

    # Never accept user ownership from the frontend.
    data["user_id"] = user_id

    result = transactions_collection.insert_one(data)

    saved = transactions_collection.find_one(
        {
            "_id": result.inserted_id,
            "user_id": user_id,
        }
    )

    return serialize_transaction(saved)


# --------------------------------------------------
# UPDATE TRANSACTION
# AUTHENTICATED USER ONLY
# --------------------------------------------------

@app.put("/api/transactions/{transaction_id}")
@limiter.limit("60/minute")
def update_transaction(
    request: Request,
    transaction_id: str,
    transaction: Transaction,
    user_id: str = Depends(get_current_user),
):
    obj_id = get_object_id(transaction_id)

    data = transaction.model_dump(
        mode="json"
    )

    result = transactions_collection.update_one(
        {
            "_id": obj_id,
            "user_id": user_id,
        },
        {
            "$set": data,
        },
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found",
        )

    updated = transactions_collection.find_one(
        {
            "_id": obj_id,
            "user_id": user_id,
        }
    )

    return serialize_transaction(updated)


# --------------------------------------------------
# DELETE TRANSACTION
# AUTHENTICATED USER ONLY
# --------------------------------------------------

@app.delete("/api/transactions/{transaction_id}")
@limiter.limit("60/minute")
def delete_transaction(
    request: Request,
    transaction_id: str,
    user_id: str = Depends(get_current_user),
):
    obj_id = get_object_id(transaction_id)

    result = transactions_collection.delete_one(
        {
            "_id": obj_id,
            "user_id": user_id,
        }
    )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found",
        )

    return {
        "message": "Transaction deleted successfully",
    }
