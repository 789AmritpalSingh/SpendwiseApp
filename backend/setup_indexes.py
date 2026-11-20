
import os

from dotenv import load_dotenv
from pymongo import ASCENDING, DESCENDING, MongoClient

load_dotenv()

MONGO_URI = os.environ["MONGO_URI"]
MONGO_DB = os.environ["MONGO_DB"]

client = MongoClient(
    MONGO_URI,
    serverSelectionTimeoutMS=5000,
)
db = client[MONGO_DB]


def ensure_index(collection, keys, name, unique=False):
    existing_indexes = list(collection.list_indexes())

    for index in existing_indexes:
        if list(index["key"].items()) == keys:
            if bool(index.get("unique", False)) != unique:
                raise RuntimeError(
                    f"{collection.name}: Index '{index['name']}' "
                    "exists with different uniqueness settings."
                )

            print(
                f"Already exists: {collection.name}.{index['name']}"
            )
            return

    collection.create_index(
        keys,
        name=name,
        unique=unique,
    )

    print(f"Created: {collection.name}.{name}")


def ensure_import_index(transactions):
    index_name = "unique_user_import_row"

    keys = [
        ("user_id", ASCENDING),
        ("import_batch_id", ASCENDING),
        ("import_row_index", ASCENDING),
    ]

    partial_filter = {
        "import_batch_id": {
            "$type": "string",
        }
    }

    for index in transactions.list_indexes():
        if index["name"] == index_name:
            if (
                list(index["key"].items()) != keys
                or not index.get("unique", False)
                or index.get("partialFilterExpression")
                != partial_filter
            ):
                raise RuntimeError(
                    f"Index '{index_name}' exists with "
                    "incorrect configuration. "
                    "Inspect it in MongoDB Compass."
                )

            print(
                f"Already exists: transactions.{index_name}"
            )
            return

    transactions.create_index(
        keys,
        unique=True,
        name=index_name,
        partialFilterExpression=partial_filter,
    )

    print(
        f"Created: transactions.{index_name}"
    )


def main():
    try:
        client.admin.command("ping")
        print("Connected to MongoDB.")

        transactions = db["transactions"]
        budgets = db["budgets"]

        # 1. Speed up user-specific transaction queries.
        ensure_index(
            transactions,
            [
                ("user_id", ASCENDING),
                ("date", DESCENDING),
            ],
            "idx_transactions_user_date",
        )

        # 2. Prevent duplicate CSV import rows.
        # Manual transactions are excluded from this index.
        ensure_import_index(transactions)

        # 3. Allow one budget per user/month/category.
        ensure_index(
            budgets,
            [
                ("user_id", ASCENDING),
                ("month", ASCENDING),
                ("category", ASCENDING),
            ],
            "unique_user_month_category",
            unique=True,
        )

        print("Index setup completed successfully.")

    finally:
        client.close()


if __name__ == "__main__":
    main()
