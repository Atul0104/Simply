"""Protect legacy orders and create immutable tax-invoice indexes. Dry-run by default."""
import argparse
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

MIGRATION_ID = "007_tax_invoices"
load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--rollback", action="store_true")
    args = parser.parse_args()
    if os.environ.get("USE_MOCK_DB", "false").lower() == "true":
        raise RuntimeError("Migration requires real MongoDB")
    client = MongoClient(os.environ["MONGO_URL"])
    db = client[os.environ.get("DB_NAME", "perfurm")]

    if args.rollback:
        print("Rollback drops invoice indexes and migration metadata only; invoices and tax snapshots are retained.")
        if args.apply:
            for name in ("invoice_number_1", "order_id_1_seller_id_1", "customer_id_1_issued_at_-1"):
                try:
                    db.invoices.drop_index(name)
                except Exception:
                    pass
            db.schema_migrations.update_one(
                {"id": MIGRATION_ID},
                {"$set": {"status": "rolled_back", "rolled_back_at": datetime.now(timezone.utc)}},
                upsert=True,
            )
        return

    legacy_filter = {"$or": [{"tax_percentage": {"$exists": False}}, {"tax_amount": {"$exists": False}}]}
    legacy_count = db.orders.count_documents(legacy_filter)
    duplicate_numbers = list(db.invoices.aggregate([
        {"$group": {"_id": "$invoice_number", "count": {"$sum": 1}}},
        {"$match": {"_id": {"$ne": None}, "count": {"$gt": 1}}},
        {"$limit": 5},
    ]))
    duplicate_sellers = list(db.invoices.aggregate([
        {"$group": {"_id": {"order_id": "$order_id", "seller_id": "$seller_id"}, "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}},
        {"$limit": 5},
    ]))
    print(f"Legacy orders to mark invoice-ineligible: {legacy_count}")
    if duplicate_numbers or duplicate_sellers:
        raise RuntimeError("Resolve duplicate invoice records before applying unique indexes")
    if not args.apply:
        print("Dry run only; re-run with --apply")
        return

    # Never invent tax history: old orders require a deliberate finance review.
    db.orders.update_many(legacy_filter, {"$set": {"invoice_eligible": False}})
    db.orders.update_many(
        {"tax_percentage": {"$exists": True}, "tax_amount": {"$exists": True}, "invoice_eligible": {"$exists": False}},
        {"$set": {"invoice_eligible": True}},
    )
    db.invoices.create_index("invoice_number", unique=True)
    db.invoices.create_index([("order_id", 1), ("seller_id", 1)], unique=True)
    db.invoices.create_index([("customer_id", 1), ("issued_at", -1)])
    db.schema_migrations.update_one(
        {"id": MIGRATION_ID},
        {"$set": {"status": "applied", "applied_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    print(f"Applied {MIGRATION_ID}")


if __name__ == "__main__":
    main()
