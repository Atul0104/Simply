"""Versioned, reversible migration for perfume catalogue fields and variant inventory.

Dry run (default): python migrations/001_perfume_catalog.py
Apply:             python migrations/001_perfume_catalog.py --apply
Rollback:          python migrations/001_perfume_catalog.py --rollback
"""

import argparse
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient


MIGRATION_ID = "001_perfume_catalog"
ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")


def slugify(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value or "fragrance"


def unique_slug(base: str, used: set[str]) -> str:
    candidate = base
    counter = 2
    while candidate in used:
        candidate = f"{base}-{counter}"
        counter += 1
    used.add(candidate)
    return candidate


def parse_size_ml(label: str):
    match = re.search(r"(\d+(?:\.\d+)?)\s*ml", label, re.IGNORECASE)
    return float(match.group(1)) if match else None


def inferred_target(category: str):
    normalized = category.lower()
    if "him" in normalized or normalized == "men":
        return "Men"
    if "her" in normalized or normalized == "women":
        return "Women"
    return "Unisex"


def build_changes(product: dict, used_slugs: set[str]):
    specifications = product.get("specifications") or {}
    notes_text = specifications.get("Notes") or specifications.get("notes") or ""
    notes = [part.strip() for part in notes_text.split(",") if part.strip()]
    changes = {
        "brand": product.get("brand") or "Perfurm",
        "slug": product.get("slug") or unique_slug(slugify(product.get("name", "fragrance")), used_slugs),
        "short_description": product.get("short_description") or product.get("description", "")[:180],
        "target_category": product.get("target_category") or inferred_target(product.get("category", "")),
        "concentration": product.get("concentration") or specifications.get("Concentration"),
        "top_notes": product.get("top_notes") or notes,
        "middle_notes": product.get("middle_notes") or [],
        "base_notes": product.get("base_notes") or [],
        "average_rating": product.get("average_rating", 0),
        "review_count": product.get("review_count", 0),
        "is_featured": product.get("is_featured", False),
        "is_bestseller": product.get("is_bestseller", False),
        "is_new_arrival": product.get("is_new_arrival", False),
        "is_limited_edition": product.get("is_limited_edition", False),
        "seo_title": product.get("seo_title") or product.get("name"),
        "seo_description": product.get("seo_description") or product.get("description", "")[:155],
        "seo_keywords": product.get("seo_keywords") or notes,
        "updated_at": datetime.now(timezone.utc),
    }
    variants = product.get("variants") or []
    if not variants and product.get("sizes"):
        variants = []
        for index, label in enumerate(product["sizes"]):
            variants.append({
                "id": str(uuid.uuid4()),
                "sku": f"{product['sku']}-{slugify(label).upper()}",
                "size_ml": parse_size_ml(label), "label": label,
                "mrp": product["mrp"], "price": product["price"],
                "cost_price": product.get("cost_price"),
                "stock_quantity": 0, "low_stock_limit": 5,
                "image": product.get("images", [None])[0] if product.get("images") else None,
                "is_active": True,
            })
        changes["variants"] = variants
        changes["requires_inventory_review"] = len(variants) > 1
    return changes, variants


def apply(db, dry_run: bool):
    if db.schema_migrations.find_one({"id": MIGRATION_ID, "status": "applied"}):
        raise RuntimeError(f"{MIGRATION_ID} is already applied")
    products = list(db.products.find({}))
    used_slugs = {item["slug"] for item in products if item.get("slug")}
    plans = []
    for product in products:
        changes, variants = build_changes(product, used_slugs)
        plans.append((product, changes, variants))
    print(f"Products inspected: {len(plans)}")
    print(f"Products requiring inventory review: {sum(bool(changes.get('requires_inventory_review')) for _, changes, _ in plans)}")
    if dry_run:
        print("Dry run only; no data changed. Re-run with --apply after reviewing inventory flags.")
        return

    with db.client.start_session() as session:
        with session.start_transaction():
            for product, changes, variants in plans:
                db.migration_backups.insert_one({
                    "migration_id": MIGRATION_ID, "collection": "products",
                    "document_id": product["id"], "document": product,
                    "created_at": datetime.now(timezone.utc),
                }, session=session)
                db.products.update_one({"_id": product["_id"]}, {"$set": changes}, session=session)
                existing_inventory = db.inventory.find_one({"product_id": product["id"]}, session=session) or {}
                for variant in variants:
                    stock = existing_inventory.get("quantity", 0) if len(variants) == 1 else 0
                    db.variant_inventory.update_one(
                        {"variant_id": variant["id"]},
                        {"$setOnInsert": {
                            "id": str(uuid.uuid4()), "product_id": product["id"],
                            "variant_id": variant["id"], "seller_id": product["seller_id"], "sku": variant["sku"],
                            "stock_quantity": stock, "reserved_quantity": 0, "available_quantity": stock,
                            "low_stock_threshold": variant["low_stock_limit"], "updated_at": datetime.now(timezone.utc),
                            "created_by_migration": MIGRATION_ID,
                        }},
                        upsert=True, session=session,
                    )
            db.schema_migrations.insert_one({
                "id": MIGRATION_ID, "status": "applied", "applied_at": datetime.now(timezone.utc),
                "product_count": len(plans),
            }, session=session)
    print(f"Applied {MIGRATION_ID} successfully")


def rollback(db, dry_run: bool):
    migration = db.schema_migrations.find_one({"id": MIGRATION_ID, "status": "applied"})
    if not migration:
        raise RuntimeError(f"{MIGRATION_ID} is not applied")
    backups = list(db.migration_backups.find({"migration_id": MIGRATION_ID, "collection": "products"}))
    print(f"Product documents to restore: {len(backups)}")
    if dry_run:
        print("Rollback dry run only; re-run with --rollback --apply to restore data.")
        return
    with db.client.start_session() as session:
        with session.start_transaction():
            for backup in backups:
                document = backup["document"]
                db.products.replace_one({"_id": document["_id"]}, document, session=session)
            db.variant_inventory.delete_many({"created_by_migration": MIGRATION_ID}, session=session)
            db.schema_migrations.update_one(
                {"id": MIGRATION_ID},
                {"$set": {"status": "rolled_back", "rolled_back_at": datetime.now(timezone.utc)}},
                session=session,
            )
    print(f"Rolled back {MIGRATION_ID} successfully")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Persist the migration or rollback")
    parser.add_argument("--rollback", action="store_true", help="Prepare or run rollback")
    args = parser.parse_args()
    if os.environ.get("USE_MOCK_DB", "false").lower() == "true":
        raise RuntimeError("Migration requires a real MongoDB deployment")
    mongo_url = os.environ.get("MONGO_URL")
    if not mongo_url:
        raise RuntimeError("MONGO_URL is required")
    client = MongoClient(mongo_url)
    db = client[os.environ.get("DB_NAME", "perfurm")]
    try:
        if args.rollback:
            rollback(db, dry_run=not args.apply)
        else:
            apply(db, dry_run=not args.apply)
    finally:
        client.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Migration failed: {exc}", file=sys.stderr)
        raise
