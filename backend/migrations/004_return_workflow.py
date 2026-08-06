"""Backfill safe active-return keys and return-workflow indexes. Dry-run by default."""

import argparse
import os
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

MIGRATION_ID = "004_return_workflow"
ACTIVE_STATUSES = ["pending", "approved", "pickup_scheduled", "received"]
load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def apply(db, persist):
    active = list(db.return_requests.find({"status": {"$in": ACTIVE_STATUSES}}))
    counts = Counter(row.get("order_id") for row in active)
    conflicts = sorted(order_id for order_id, count in counts.items() if order_id and count > 1)
    print(f"Active requests inspected: {len(active)}; conflicting orders: {len(conflicts)}")
    if conflicts:
        print("Conflicting order IDs:", ", ".join(conflicts[:25]))
        if persist:
            raise RuntimeError("Resolve duplicate active return requests before applying this migration")
    if not persist:
        print("Dry run only; re-run with --apply")
        return
    with db.client.start_session() as session:
        with session.start_transaction():
            for row in active:
                db.migration_backups.insert_one({
                    "migration_id": MIGRATION_ID, "collection": "return_requests",
                    "document_id": row.get("id"), "document": row, "created_at": datetime.now(timezone.utc),
                }, session=session)
                db.return_requests.update_one(
                    {"_id": row["_id"]}, {"$set": {"active_key": row["order_id"]}}, session=session,
                )
            db.schema_migrations.insert_one({
                "id": MIGRATION_ID, "status": "applied", "applied_at": datetime.now(timezone.utc),
                "active_request_count": len(active),
            }, session=session)
    db.return_requests.create_index("active_key", unique=True, sparse=True)
    db.return_requests.create_index([("customer_id", 1), ("created_at", -1)])
    db.return_requests.create_index([("seller_id", 1), ("status", 1), ("created_at", -1)])
    print(f"Applied {MIGRATION_ID}")


def rollback(db, persist):
    backups = list(db.migration_backups.find({"migration_id": MIGRATION_ID, "collection": "return_requests"}))
    print(f"Return requests to restore: {len(backups)}")
    if not persist:
        print("Rollback dry run only; re-run with --rollback --apply")
        return
    with db.client.start_session() as session:
        with session.start_transaction():
            for backup in backups:
                original = backup["document"]
                db.return_requests.replace_one({"_id": original["_id"]}, original, session=session)
            db.schema_migrations.update_one(
                {"id": MIGRATION_ID},
                {"$set": {"status": "rolled_back", "rolled_back_at": datetime.now(timezone.utc)}},
                session=session,
            )
    print(f"Rolled back {MIGRATION_ID}; audit and inventory movement records were retained")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--rollback", action="store_true")
    args = parser.parse_args()
    if os.environ.get("USE_MOCK_DB", "false").lower() == "true":
        raise RuntimeError("Migration requires real MongoDB")
    client = MongoClient(os.environ["MONGO_URL"])
    try:
        (rollback if args.rollback else apply)(client[os.environ.get("DB_NAME", "perfurm")], args.apply)
    finally:
        client.close()


if __name__ == "__main__":
    main()
