"""Retention cleanup. Dry-run by default; pass --apply after an approved backup/check."""
import argparse
import asyncio
import os
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient

async def run(apply: bool) -> None:
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ.get("DB_NAME", "ecommerce_db")]
    now = datetime.now(timezone.utc)
    rules = {
        "auth_sessions": {"expires_at": {"$lt": now - timedelta(days=30)}},
        "consent_current": {"user_id": None, "expires_at": {"$lt": now - timedelta(days=30)}},
        "creator_campaign_events": {"created_at": {"$lt": now - timedelta(days=395)}},
        "notification_jobs": {"status": {"$in": ["delivered", "dead"]}, "updated_at": {"$lt": now - timedelta(days=90)}},
    }
    for collection, query in rules.items():
        count = await db[collection].count_documents(query)
        print(f"{collection}: {count} eligible")
        if apply and count:
            result = await db[collection].delete_many(query)
            print(f"{collection}: {result.deleted_count} deleted")
    client.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    asyncio.run(run(parser.parse_args().apply))
