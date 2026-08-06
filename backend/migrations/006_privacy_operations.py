"""Add privacy-operation permission and deletion-request indexes. Dry-run by default."""
import argparse
import os
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient

MIGRATION_ID = "006_privacy_operations"
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

def main():
    parser = argparse.ArgumentParser(); parser.add_argument("--apply", action="store_true"); parser.add_argument("--rollback", action="store_true")
    args = parser.parse_args()
    if os.environ.get("USE_MOCK_DB", "false").lower() == "true": raise RuntimeError("Migration requires real MongoDB")
    client = MongoClient(os.environ["MONGO_URL"]); db = client[os.environ.get("DB_NAME", "perfurm")]
    if args.rollback:
        print("Rollback removes privacy.manage from standard admins and drops queue indexes; request/audit records are retained.")
        if args.apply:
            db.users.update_many({"role": "admin", "admin_role": "admin"}, {"$pull": {"permissions": "privacy.manage"}})
            for name in ("status_1_requested_at_-1", "user_id_1_status_1"):
                try: db.account_deletion_requests.drop_index(name)
                except Exception: pass
            db.schema_migrations.update_one({"id": MIGRATION_ID}, {"$set": {"status": "rolled_back", "rolled_back_at": datetime.now(timezone.utc)}}, upsert=True)
        return
    count = db.users.count_documents({"role": "admin", "admin_role": "admin", "permissions": {"$ne": "privacy.manage"}})
    print(f"Standard admins requiring privacy.manage: {count}")
    if not args.apply: print("Dry run only; re-run with --apply"); return
    db.users.update_many({"role": "admin", "admin_role": "admin"}, {"$addToSet": {"permissions": "privacy.manage"}})
    db.account_deletion_requests.create_index([("status", 1), ("requested_at", -1)])
    db.account_deletion_requests.create_index([("user_id", 1), ("status", 1)])
    db.schema_migrations.update_one({"id": MIGRATION_ID}, {"$set": {"status": "applied", "applied_at": datetime.now(timezone.utc)}}, upsert=True)
    print(f"Applied {MIGRATION_ID}")

if __name__ == "__main__": main()
