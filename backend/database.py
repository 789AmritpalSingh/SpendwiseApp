
import os

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb://127.0.0.1:27017/"
)

DB_NAME = os.getenv("MONGO_DB", "spendwise")

client = MongoClient(
    MONGO_URI,
    serverSelectionTimeoutMS=3000
)

db = client[DB_NAME]
transactions_collection = db["transactions"]


def check_database():
    client.admin.command("ping")
    return True
