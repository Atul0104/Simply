"""Backfill moderation metadata and create review-integrity indexes.

Usage: python backend/migrations/005_review_integrity.py [--apply|--rollback]
Legacy reviews remain public as approved, but are only marked verified when the
referenced delivered order proves that the customer purchased the product.
"""
import argparse
import asyncio
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

async def main(apply=False, rollback=False):
    client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = client[os.environ.get("DB_NAME", "perfurm")]
    if rollback:
        await db.reviews.drop_index("order_item_key_1")
        await db.reviews.drop_index("moderation_status_1_created_at_-1")
        await db.reviews.drop_index("product_id_1_moderation_status_1_created_at_-1")
        print("Review integrity indexes removed; moderation data retained for audit safety.")
        return
    plans = []
    async for review in db.reviews.find({"moderation_status": {"$exists": False}}):
        order = await db.orders.find_one({"id": review.get("order_id"), "customer_id": review.get("customer_id")})
        item = next((entry for entry in (order or {}).get("items", []) if entry.get("product_id") == review.get("product_id")), None)
        verified = bool(order and order.get("status") == "delivered" and item)
        key = f"{review.get('order_id')}:{review.get('product_id')}:{(item or {}).get('variant_id') or (item or {}).get('size') or 'base'}" if verified else None
        plans.append((review["_id"], {"moderation_status": "approved", "verified_purchase": verified, "order_item_key": key,
            "moderation_history": [{"status": "approved", "at": datetime.now(timezone.utc), "actor_id": "migration", "reason": "Legacy review backfill"}]}))
    keys = [changes["order_item_key"] for _, changes in plans if changes["order_item_key"]]
    duplicates = sorted({key for key in keys if keys.count(key) > 1})
    print(f"Legacy reviews to backfill: {len(plans)}; duplicate purchase keys: {len(duplicates)}")
    if duplicates: raise RuntimeError("Duplicate reviews found for a purchased order item; resolve before applying")
    if not apply:
        print("Dry run only. Re-run with --apply after review."); return
    for review_id, changes in plans:
        if changes["order_item_key"] is None: changes.pop("order_item_key")
        await db.reviews.update_one({"_id": review_id}, {"$set": changes})
    await db.reviews.create_index("order_item_key", unique=True, sparse=True)
    await db.reviews.create_index([("moderation_status", 1), ("created_at", -1)])
    await db.reviews.create_index([("product_id", 1), ("moderation_status", 1), ("created_at", -1)])
    await db.review_helpful_votes.create_index("id", unique=True)
    print("Review integrity migration applied.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("--apply", action="store_true"); parser.add_argument("--rollback", action="store_true")
    args = parser.parse_args(); asyncio.run(main(args.apply, args.rollback))
