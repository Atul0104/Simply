"""Fail-fast MongoDB transaction qualification for staging deployments.

Run inside the backend image after migrations and before enabling checkout:
    python scripts/qualify_transactions.py
"""
import os
import sys
import uuid

from pymongo import MongoClient


def main() -> int:
    mongo_url = os.environ.get("MONGO_URL")
    if not mongo_url:
        print("MONGO_URL is required", file=sys.stderr)
        return 2
    database_name = os.environ.get("DB_NAME", "perfurm")
    client = MongoClient(mongo_url, serverSelectionTimeoutMS=10_000)
    database = client[database_name]
    probe_id = f"transaction-qualification-{uuid.uuid4()}"
    collection = database["transaction_qualification"]
    try:
        hello = client.admin.command("hello")
        if not hello.get("setName"):
            raise RuntimeError("MongoDB is not connected to a replica set")

        with client.start_session() as session:
            session.start_transaction()
            collection.insert_one({"_id": probe_id, "phase": "abort"}, session=session)
            session.abort_transaction()
        if collection.count_documents({"_id": probe_id}) != 0:
            raise RuntimeError("Aborted transaction left a durable write")

        with client.start_session() as session:
            with session.start_transaction():
                collection.insert_one({"_id": probe_id, "phase": "commit"}, session=session)
        if collection.count_documents({"_id": probe_id, "phase": "commit"}) != 1:
            raise RuntimeError("Committed transaction was not durable")
        collection.delete_one({"_id": probe_id})
        print(f"MongoDB transaction qualification passed on replica set {hello['setName']}")
        return 0
    except Exception as error:
        collection.delete_one({"_id": probe_id})
        print(f"MongoDB transaction qualification failed: {error}", file=sys.stderr)
        return 1
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
