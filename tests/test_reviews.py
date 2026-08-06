import os
import sys
import uuid
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "perfurm_review_test")
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret")
os.environ.setdefault("USE_MOCK_DB", "true")
os.environ.setdefault("APP_ENV", "test")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from fastapi.testclient import TestClient
import server


def bearer(token, idempotency=None):
    headers = {"Authorization": f"Bearer {token}"}
    if idempotency: headers["Idempotency-Key"] = idempotency
    return headers


def test_verified_purchase_review_moderation_and_public_visibility():
    suffix = uuid.uuid4().hex[:10]
    with TestClient(server.app) as client:
        admin = client.post("/api/auth/login", json={"email": "admin@perfurm.com", "password": "admin123"}).json()
        customer = client.post("/api/auth/register", json={"email": f"review-{suffix}@example.com", "password": "Secure123!", "name": "Review Buyer", "role": "customer"}).json()
        products = client.get("/api/products").json()
        purchased, other = [item for item in products if not item.get("variants")][:2]
        order_response = client.post("/api/orders", headers=bearer(customer["access_token"], f"review-order-{suffix}"), json={
            "items": [{"product_id": purchased["id"], "quantity": 1}], "total_amount": 1,
            "payment_method": "cod", "shipping_address": {"address": "Test", "pincode": "400001"},
        })
        assert order_response.status_code == 200, order_response.text
        order = order_response.json()
        base_review = {"order_id": order["id"], "product_id": purchased["id"], "rating": 5, "comment": "A memorable and beautifully balanced fragrance."}
        assert client.post("/api/reviews", headers=bearer(customer["access_token"]), json=base_review).status_code == 409

        for status in ("processing", "packed", "ready_for_shipment", "shipped", "out_for_delivery", "delivered"):
            response = client.put(f"/api/orders/{order['id']}/status", params={"status": status}, headers=bearer(admin["access_token"]))
            assert response.status_code == 200, response.text

        unpurchased = client.post("/api/reviews", headers=bearer(customer["access_token"]), json={**base_review, "product_id": other["id"]})
        assert unpurchased.status_code == 403
        invalid = client.post("/api/reviews", headers=bearer(customer["access_token"]), json={**base_review, "rating": 6})
        assert invalid.status_code == 422
        created = client.post("/api/reviews", headers=bearer(customer["access_token"]), json=base_review)
        assert created.status_code == 200, created.text
        review = created.json()
        assert review["verified_purchase"] is True and review["moderation_status"] == "pending"
        assert client.post("/api/reviews", headers=bearer(customer["access_token"]), json=base_review).status_code == 409
        assert all(item["id"] != review["id"] for item in client.get(f"/api/reviews/product/{purchased['id']}").json())

        analyst_email = f"review-analyst-{suffix}@example.com"
        client.post("/api/admin/staff", headers=bearer(admin["access_token"]), json={"email": analyst_email, "password": "Analyst123!", "name": "Review Analyst", "admin_role": "read_only_analyst"})
        analyst = client.post("/api/auth/login", json={"email": analyst_email, "password": "Analyst123!"}).json()
        assert client.get("/api/admin/reviews", headers=bearer(analyst["access_token"])).status_code == 403
        queue = client.get("/api/admin/reviews", params={"status": "pending"}, headers=bearer(admin["access_token"]))
        assert any(item["id"] == review["id"] for item in queue.json()["items"])
        approved = client.patch(f"/api/admin/reviews/{review['id']}", headers=bearer(admin["access_token"]), json={"status": "approved", "reason": "Verified purchase and compliant content"})
        assert approved.status_code == 200, approved.text
        assert approved.json()["moderation_history"][-1]["status"] == "approved"
        public = client.get(f"/api/reviews/product/{purchased['id']}").json()
        assert any(item["id"] == review["id"] for item in public)
        summary = client.get(f"/api/reviews/product/{purchased['id']}/summary").json()
        assert summary["total_reviews"] >= 1

