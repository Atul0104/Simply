"""Backfill granular admin roles. Dry-run by default; use --apply or --rollback --apply."""

import argparse
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

MIGRATION_ID = "002_admin_rbac"
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

ADMIN_PERMISSIONS = [
    "sellers.manage", "customers.read", "privacy.manage", "orders.manage", "refunds.manage", "products.manage",
    "inventory.manage", "marketing.manage", "content.manage", "support.manage", "finance.manage",
    "analytics.read", "shipping.manage", "platform.manage",
]


def apply(db, persist):
    email = os.environ.get("BOOTSTRAP_SUPER_ADMIN_EMAIL", "").lower().strip()
    if not email:
        raise RuntimeError("BOOTSTRAP_SUPER_ADMIN_EMAIL is required")
    admins = list(db.users.find({"role": "admin"}))
    if not any(str(admin.get("email", "")).lower() == email for admin in admins):
        raise RuntimeError("The bootstrap super-admin email does not match an existing admin")
    print(f"Admins inspected: {len(admins)}; designated super admin: {email}")
    if not persist:
        print("Dry run only; re-run with --apply")
        return
    with db.client.start_session() as session:
        with session.start_transaction():
            for admin in admins:
                db.migration_backups.insert_one({
                    "migration_id": MIGRATION_ID, "collection": "users", "document_id": admin["id"],
                    "document": admin, "created_at": datetime.now(timezone.utc),
                }, session=session)
                is_super = str(admin.get("email", "")).lower() == email
                db.users.update_one({"_id": admin["_id"]}, {"$set": {
                    "admin_role": "super_admin" if is_super else "admin",
                    "permissions": ["*"] if is_super else ADMIN_PERMISSIONS,
                }}, session=session)
            db.schema_migrations.insert_one({
                "id": MIGRATION_ID, "status": "applied", "applied_at": datetime.now(timezone.utc),
                "admin_count": len(admins), "super_admin_email": email,
            }, session=session)
    print(f"Applied {MIGRATION_ID}")


def rollback(db, persist):
    backups = list(db.migration_backups.find({"migration_id": MIGRATION_ID, "collection": "users"}))
    if not backups:
        raise RuntimeError("No RBAC migration backups found")
    print(f"Admin documents to restore: {len(backups)}")
    if not persist:
        print("Rollback dry run only; re-run with --rollback --apply")
        return
    with db.client.start_session() as session:
        with session.start_transaction():
            for backup in backups:
                original = backup["document"]
                db.users.replace_one({"_id": original["_id"]}, original, session=session)
            db.schema_migrations.update_one(
                {"id": MIGRATION_ID}, {"$set": {"status": "rolled_back", "rolled_back_at": datetime.now(timezone.utc)}},
                session=session,
            )
    print(f"Rolled back {MIGRATION_ID}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--rollback", action="store_true")
    args = parser.parse_args()
    if os.environ.get("USE_MOCK_DB", "false").lower() == "true":
        raise RuntimeError("Migration requires real MongoDB")
    client = MongoClient(os.environ["MONGO_URL"])
    try:
        database = client[os.environ.get("DB_NAME", "perfurm")]
        (rollback if args.rollback else apply)(database, args.apply)
    finally:
        client.close()


if __name__ == "__main__":
    main()
