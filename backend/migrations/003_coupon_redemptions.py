"""Harden coupon limits and redemption ledgers. Dry-run by default."""

import argparse
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

MIGRATION_ID = "003_coupon_redemptions"
load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def apply(db, persist):
    coupons = list(db.coupons.find({"per_customer_usage_limit": {"$exists": False}}))
    print(f"Coupons requiring a per-customer limit: {len(coupons)}")
    if not persist:
        print("Dry run only; re-run with --apply")
        return
    with db.client.start_session() as session:
        with session.start_transaction():
            for coupon in coupons:
                db.migration_backups.insert_one({
                    "migration_id": MIGRATION_ID, "collection": "coupons",
                    "document_id": coupon.get("id"), "document": coupon,
                    "created_at": datetime.now(timezone.utc),
                }, session=session)
                db.coupons.update_one(
                    {"_id": coupon["_id"]}, {"$set": {"per_customer_usage_limit": 1}}, session=session,
                )
            db.schema_migrations.insert_one({
                "id": MIGRATION_ID, "status": "applied", "applied_at": datetime.now(timezone.utc),
                "coupon_count": len(coupons),
            }, session=session)
    db.coupons.create_index("code", unique=True)
    db.coupon_customer_usage.create_index([("coupon_id", 1), ("customer_id", 1)], unique=True)
    db.coupon_redemptions.create_index("order_id", unique=True)
    db.coupon_redemptions.create_index([("coupon_id", 1), ("customer_id", 1), ("created_at", -1)])
    print(f"Applied {MIGRATION_ID}")


def rollback(db, persist):
    backups = list(db.migration_backups.find({"migration_id": MIGRATION_ID, "collection": "coupons"}))
    print(f"Coupon documents to restore: {len(backups)}")
    if not persist:
        print("Rollback dry run only; re-run with --rollback --apply")
        return
    with db.client.start_session() as session:
        with session.start_transaction():
            for backup in backups:
                original = backup["document"]
                db.coupons.replace_one({"_id": original["_id"]}, original, session=session)
            db.schema_migrations.update_one(
                {"id": MIGRATION_ID},
                {"$set": {"status": "rolled_back", "rolled_back_at": datetime.now(timezone.utc)}},
                session=session,
            )
    print(f"Rolled back {MIGRATION_ID}; redemption history was retained for audit safety")


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
