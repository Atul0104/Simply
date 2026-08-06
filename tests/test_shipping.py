import hashlib
import hmac
import json
import os
import sys
import uuid
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "perfurm_shipping_test")
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


def test_signed_shipping_webhook_is_idempotent_and_tracking_is_private():
    suffix = uuid.uuid4().hex[:10]
    original_secret, original_url = server.SHIPPING_PROVIDER_WEBHOOK_SECRET, server.SHIPPING_PROVIDER_API_URL
    server.SHIPPING_PROVIDER_WEBHOOK_SECRET = "shipping-test-secret"
    server.SHIPPING_PROVIDER_API_URL = None
    try:
        with TestClient(server.app) as client:
            seller = client.post("/api/auth/login", json={"email": "seller1@example.com", "password": "seller123"}).json()
            customer = client.post("/api/auth/register", json={"email": f"shipping-{suffix}@example.com", "password": "Secure123!", "name": "Shipping Buyer", "role": "customer"}).json()
            outsider = client.post("/api/auth/register", json={"email": f"shipping-other-{suffix}@example.com", "password": "Secure123!", "name": "Other Buyer", "role": "customer"}).json()
            product = next(item for item in client.get("/api/products").json() if not item.get("variants") and item["seller_id"] == "preview-atelier")
            order = client.post("/api/orders", headers=bearer(customer["access_token"], f"shipping-order-{suffix}"), json={"items": [{"product_id": product["id"], "quantity": 1}], "total_amount": 1, "payment_method": "cod", "shipping_address": {"address": "Test", "pincode": "400001"}}).json()
            label_response = client.post("/api/shipping-labels", headers=bearer(seller["access_token"]), json={"order_id": order["id"], "warehouse_id": f"warehouse-{suffix}", "weight": 0.5})
            assert label_response.status_code == 200, label_response.text
            tracking_id = label_response.json()["tracking_id"]
            label_download = client.get(f"/api/shipping-labels/{order['id']}/download", headers=bearer(seller["access_token"]))
            assert label_download.status_code == 200
            assert tracking_id in label_download.text and "Ship to" in label_download.text and "4in 6in" in label_download.text
            payload = {"event_id": f"ship-{suffix}", "tracking_id": tracking_id, "status": "in_transit", "location": "Mumbai hub"}
            body = json.dumps(payload).encode()
            assert client.post("/api/shipping/webhook", content=body, headers={"Content-Type": "application/json", "X-Shipping-Signature": "invalid"}).status_code == 401
            signature = hmac.new(b"shipping-test-secret", body, hashlib.sha256).hexdigest()
            response = client.post("/api/shipping/webhook", content=body, headers={"Content-Type": "application/json", "X-Shipping-Signature": signature})
            assert response.status_code == 200, response.text
            duplicate = client.post("/api/shipping/webhook", content=body, headers={"Content-Type": "application/json", "X-Shipping-Signature": signature})
            assert duplicate.json()["duplicate"] is True
            allowed = client.get(f"/api/orders/{order['id']}/tracking", headers=bearer(customer["access_token"]))
            assert allowed.status_code == 200 and allowed.json()["delivery_history"][0]["status"] == "in_transit"
            assert client.get(f"/api/orders/{order['id']}/tracking", headers=bearer(outsider["access_token"])).status_code == 403
    finally:
        server.SHIPPING_PROVIDER_WEBHOOK_SECRET, server.SHIPPING_PROVIDER_API_URL = original_secret, original_url
