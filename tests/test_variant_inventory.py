import os
import sys
import uuid
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "perfurm_variant_test")
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret")
os.environ.setdefault("USE_MOCK_DB", "true")
os.environ.setdefault("APP_ENV", "test")

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from fastapi.testclient import TestClient
from server import app


def auth_headers(token, idempotency_key=None):
    headers = {"Authorization": f"Bearer {token}"}
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    return headers


def test_variant_price_and_stock_are_authoritative_at_checkout():
    suffix = uuid.uuid4().hex[:10]
    with TestClient(app) as client:
        seller_login = client.post(
            "/api/auth/login", json={"email": "seller1@example.com", "password": "seller123"}
        )
        assert seller_login.status_code == 200
        seller_token = seller_login.json()["access_token"]
        variant_sku = f"VAR-{suffix}"
        product_response = client.post(
            "/api/products",
            headers=auth_headers(seller_token),
            json={
                "name": "Transactional Iris",
                "description": "Variant inventory test fragrance",
                "category": "For Her",
                "price": 1000,
                "mrp": 1200,
                "sku": f"PROD-{suffix}",
                "images": ["https://example.com/transactional-iris.jpg"],
                "sizes": ["50 ml"],
                "variants": [{
                    "sku": variant_sku, "size_ml": 50, "label": "50 ml",
                    "price": 1490, "mrp": 1790, "stock_quantity": 3,
                }],
            },
        )
        assert product_response.status_code == 200, product_response.text
        product = product_response.json()
        variant = product["variants"][0]

        customer = client.post(
            "/api/auth/register",
            json={
                "email": f"variant-{suffix}@example.com", "password": "Secure123!",
                "name": "Variant Buyer", "role": "customer",
            },
        )
        customer_token = customer.json()["access_token"]
        order_response = client.post(
            "/api/orders",
            headers=auth_headers(customer_token, f"variant-order-{suffix}"),
            json={
                "items": [{
                    "product_id": product["id"], "variant_id": variant["id"],
                    "size": "50 ml", "quantity": 2, "price": 1,
                }],
                "total_amount": 1, "payment_method": "cod",
                "shipping_address": {"address": "Test address", "pincode": "400001"},
            },
        )
        assert order_response.status_code == 200, order_response.text
        order = order_response.json()
        assert order["items"][0]["price"] == 1490
        assert order["total_amount"] == 2980
        assert order["items"][0]["variant_sku"] == variant_sku
        assert order["items"][0]["image"] == "https://example.com/transactional-iris.jpg"
        assert order["reservation_status"] == "finalized"

        customer_headers = auth_headers(customer_token)
        my_orders = client.get("/api/orders/my", headers=customer_headers)
        assert my_orders.status_code == 200
        assert my_orders.json()[0]["items"][0]["name"] == "Transactional Iris"
        assert my_orders.json()[0]["items"][0]["image"] == "https://example.com/transactional-iris.jpg"
        notifications = client.get("/api/notifications/my", headers=customer_headers).json()
        placed_notification = next(item for item in notifications if item["title"] == "Order Placed")
        assert "Transactional Iris" in placed_notification["message"]
        assert placed_notification["link_url"] == "/customer/orders"

        inventory_response = client.get("/api/inventory/variants", headers=auth_headers(seller_token))
        record = next(item for item in inventory_response.json() if item["variant_id"] == variant["id"])
        assert record["stock_quantity"] == 1
        assert record["available_quantity"] == 1
        assert record["reserved_quantity"] == 0

        cancelled = client.put(
            f"/api/orders/{order['id']}/status",
            params={"status": "cancelled"}, headers=auth_headers(seller_token),
        )
        assert cancelled.status_code == 200, cancelled.text
        restored = client.get("/api/inventory/variants", headers=auth_headers(seller_token)).json()
        restored_record = next(item for item in restored if item["variant_id"] == variant["id"])
        assert restored_record["stock_quantity"] == 3
        assert restored_record["available_quantity"] == 3
        assert restored_record["reserved_quantity"] == 0

        movements = client.get("/api/inventory/movements", headers=auth_headers(seller_token)).json()["items"]
        order_movements = [movement for movement in movements if movement.get("order_id") == order["id"]]
        # COD is now a single atomic sale; it no longer creates a transient reservation.
        assert {movement["type"] for movement in order_movements} >= {
            "sale", "cancellation_restock"
        }
        assert "reservation" not in {movement["type"] for movement in order_movements}


def test_preview_bottle_sizes_have_distinct_authoritative_prices_and_no_color_requirement():
    with TestClient(app) as client:
        product = next(item for item in client.get("/api/products").json() if item["sku"] == "PFM001")
        variants = product["variants"]
        assert [variant["label"] for variant in variants] == ["10 ml", "50 ml", "100 ml"]
        assert len({variant["price"] for variant in variants}) == 3
        assert variants[0]["price"] < variants[1]["price"] < variants[2]["price"]
        assert product.get("colors", []) == []

        customer = client.post("/api/auth/register", json={
            "email": f"bottle-{uuid.uuid4().hex[:10]}@example.com", "password": "Secure123!",
            "name": "Bottle Buyer", "role": "customer",
        }).json()
        prices = []
        for variant in (variants[0], variants[-1]):
            quote = client.post("/api/checkout/quote", headers=auth_headers(customer["access_token"]), json={
                "items": [{"product_id": product["id"], "variant_id": variant["id"], "quantity": 1}],
                "pincode": "400001", "state": "Maharashtra",
            })
            assert quote.status_code == 200, quote.text
            prices.append(quote.json()["items"][0]["price"])
        assert prices == [variants[0]["price"], variants[-1]["price"]]


def test_private_seller_catalogue_and_variant_edit_synchronize_inventory():
    suffix = uuid.uuid4().hex[:10]
    with TestClient(app) as client:
        login = client.post(
            "/api/auth/login", json={"email": "seller1@example.com", "password": "seller123"}
        )
        headers = auth_headers(login.json()["access_token"])
        product_payload = {
            "name": f"Nocturne Vetiver {suffix}", "brand": "Perfurm Atelier",
            "description": "A production catalogue synchronization test.", "category": "For Him",
            "target_category": "Men", "fragrance_family": "Woody", "concentration": "EDP",
            "price": 2200, "mrp": 2600, "cost_price": 900, "sku": f"CAT-{suffix}",
            "top_notes": ["Bergamot"], "middle_notes": ["Vetiver"], "base_notes": ["Cedar"],
            "images": ["https://example.com/nocturne.jpg"], "sizes": ["50 ml"],
            "is_featured": True, "is_bestseller": True,
            "variants": [{
                "sku": f"CAT-{suffix}-50", "size_ml": 50, "label": "50 ml",
                "price": 2200, "mrp": 2600, "cost_price": 900, "stock_quantity": 4,
            }],
        }
        created = client.post("/api/products", headers=headers, json=product_payload)
        assert created.status_code == 200, created.text
        product = created.json()
        assert product["is_featured"] is False
        assert product["is_bestseller"] is False

        private_list = client.get(
            "/api/seller/products", headers=headers,
            params={"q": suffix, "page": 1, "page_size": 1},
        )
        assert private_list.status_code == 200
        assert private_list.json()["total"] == 1
        assert private_list.json()["items"][0]["cost_price"] == 900

        original_variant = product["variants"][0]
        product_payload["slug"] = "custom-nocturne-" + suffix
        product_payload["variants"][0] = original_variant
        product_payload["variants"].append({
            "sku": f"CAT-{suffix}-100", "size_ml": 100, "label": "100 ml",
            "price": 3600, "mrp": 4200, "cost_price": 1500, "stock_quantity": 2,
        })
        updated = client.put(f"/api/products/{product['id']}", headers=headers, json=product_payload)
        assert updated.status_code == 200, updated.text
        assert updated.json()["slug"] == "custom-nocturne-" + suffix
        inventory = client.get("/api/inventory/variants", headers=headers).json()
        records = [item for item in inventory if item["product_id"] == product["id"]]
        assert len(records) == 2
        assert next(item for item in records if item["variant_id"] == original_variant["id"])["stock_quantity"] == 4
        assert next(item for item in records if item["sku"].endswith("-100"))["stock_quantity"] == 2

        invalid = {**product_payload, "price": 5000, "mrp": 1000}
        rejected = client.put(f"/api/products/{product['id']}", headers=headers, json=invalid)
        assert rejected.status_code == 422
