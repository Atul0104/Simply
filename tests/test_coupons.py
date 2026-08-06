import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "perfurm_coupon_test")
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret")
os.environ.setdefault("USE_MOCK_DB", "true")
os.environ.setdefault("APP_ENV", "test")

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from fastapi.testclient import TestClient
import server


def bearer(token, idempotency=None):
    headers = {"Authorization": f"Bearer {token}"}
    if idempotency:
        headers["Idempotency-Key"] = idempotency
    return headers


def test_coupon_is_authoritative_limited_idempotent_and_released_on_cancel():
    suffix = uuid.uuid4().hex[:10]
    code = f"SAVE-{suffix}"
    with TestClient(server.app) as client:
        admin = client.post(
            "/api/auth/login", json={"email": "admin@perfurm.com", "password": "admin123"},
        ).json()
        customer = client.post("/api/auth/register", json={
            "email": f"coupon-{suffix}@example.com", "password": "Secure123!",
            "name": "Coupon Buyer", "role": "customer",
        }).json()
        admin_headers = bearer(admin["access_token"])
        customer_headers = bearer(customer["access_token"])

        now = datetime.now(timezone.utc)
        created = client.post("/api/admin/coupons", headers=admin_headers, json={
            "code": code, "discount_type": "percentage", "discount_value": 10,
            "min_order_amount": 100, "max_discount": 250, "usage_limit": 10,
            "per_customer_usage_limit": 1,
            "valid_from": (now - timedelta(minutes=1)).isoformat(),
            "valid_until": (now + timedelta(days=2)).isoformat(),
        })
        assert created.status_code == 200, created.text

        product = next(item for item in client.get("/api/products").json() if not item.get("variants"))
        validated = client.get(
            f"/api/coupons/validate/{code}", headers=customer_headers,
            params={"order_amount": product["price"]},
        )
        assert validated.status_code == 200, validated.text
        expected_discount = min(round(product["price"] * 0.10, 2), 250)
        assert validated.json()["discount"] == expected_discount

        payload = {
            "items": [{"product_id": product["id"], "quantity": 1, "price": 1}],
            "total_amount": 1, "coupon_code": code, "payment_method": "cod",
            "shipping_address": {"address": "Test address", "pincode": "400001"},
        }
        key = f"coupon-order-{suffix}"
        first = client.post("/api/orders", headers=bearer(customer["access_token"], key), json=payload)
        duplicate = client.post("/api/orders", headers=bearer(customer["access_token"], key), json=payload)
        assert first.status_code == 200, first.text
        assert duplicate.status_code == 200, duplicate.text
        order = first.json()
        assert duplicate.json()["id"] == order["id"]
        assert order["coupon_code"] == code.upper()
        assert order["discount_amount"] == expected_discount
        assert order["total_amount"] == round(order["subtotal"] - expected_discount + order["shipping_charge"], 2)

        blocked = client.post(
            "/api/orders", headers=bearer(customer["access_token"], f"coupon-second-{suffix}"), json=payload,
        )
        assert blocked.status_code == 400
        assert "account" in blocked.json()["error"]["message"].lower()

        cancelled = client.put(
            f"/api/orders/{order['id']}/status", headers=admin_headers, params={"status": "cancelled"},
        )
        assert cancelled.status_code == 200, cancelled.text
        reused = client.post(
            "/api/orders", headers=bearer(customer["access_token"], f"coupon-reuse-{suffix}"), json=payload,
        )
        assert reused.status_code == 200, reused.text


def test_coupon_validation_requires_customer_and_rejects_invalid_rules():
    suffix = uuid.uuid4().hex[:10]
    with TestClient(server.app) as client:
        unauthenticated = client.get(f"/api/coupons/validate/NONE-{suffix}", params={"order_amount": 1000})
        assert unauthenticated.status_code in {401, 403}

        admin = client.post(
            "/api/auth/login", json={"email": "admin@perfurm.com", "password": "admin123"},
        ).json()
        now = datetime.now(timezone.utc)
        invalid = client.post("/api/admin/coupons", headers=bearer(admin["access_token"]), json={
            "code": f"BAD-{suffix}", "discount_type": "percentage", "discount_value": 101,
            "valid_from": now.isoformat(), "valid_until": (now + timedelta(days=1)).isoformat(),
        })
        assert invalid.status_code == 422


def test_demo_offer_is_visible_to_guests_and_redeemable_after_login():
    suffix = uuid.uuid4().hex[:10]
    with TestClient(server.app) as client:
        guest_offers = client.get("/api/coupons/active")
        assert guest_offers.status_code == 200
        welcome = next((coupon for coupon in guest_offers.json() if coupon["code"] == "WELCOME10"), None)
        assert welcome is not None
        offer_cards = client.get("/api/offer-cards")
        assert offer_cards.status_code == 200
        assert any("WELCOME10" in card["description"] for card in offer_cards.json())

        customer = client.post("/api/auth/register", json={
            "email": f"demo-offer-{suffix}@example.com", "password": "Secure123!",
            "name": "Offer Buyer", "role": "customer",
        }).json()
        product = next(item for item in client.get("/api/products").json() if not item.get("variants"))
        validated = client.get(
            "/api/coupons/validate/WELCOME10",
            headers=bearer(customer["access_token"]),
            params={"order_amount": product["price"]},
        )
        assert validated.status_code == 200, validated.text
        assert validated.json()["valid"] is True
        assert validated.json()["discount"] > 0
