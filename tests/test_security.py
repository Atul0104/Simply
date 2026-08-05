import os
import sys
import uuid
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "perfurm_test")
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret")
os.environ.setdefault("USE_MOCK_DB", "true")
os.environ.setdefault("ENABLE_DEMO_OTP", "false")

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from fastapi.testclient import TestClient
from server import app


def registration(role="customer", phone=None):
    suffix = uuid.uuid4().hex
    return {
        "email": f"audit-{suffix}@example.com",
        "password": "Secure123!",
        "name": "Security Audit",
        "phone": phone,
        "role": role,
    }


def test_privileged_roles_cannot_self_register():
    with TestClient(app) as client:
        for role in ("admin", "delivery_partner"):
            response = client.post("/api/auth/register", json=registration(role))
            assert response.status_code == 403


def test_otp_is_not_disclosed_by_default():
    phone = f"9{uuid.uuid4().int % 1_000_000_000:09d}"
    with TestClient(app) as client:
        created = client.post("/api/auth/register", json=registration(phone=phone))
        assert created.status_code == 200
        response = client.post("/api/auth/send-otp", json={"phone": phone, "method": "sms"})
        assert response.status_code == 200
        assert "demo_otp" not in response.json()


def test_order_uses_catalog_price_not_client_price():
    with TestClient(app) as client:
        created = client.post("/api/auth/register", json=registration())
        token = created.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        product = client.get("/api/products").json()[0]
        response = client.post(
            "/api/orders",
            headers=headers,
            json={
                "items": [{
                    "product_id": product["id"],
                    "seller_id": "attacker-seller",
                    "name": "Tampered product",
                    "price": 1,
                    "quantity": 1,
                }],
                "total_amount": 1,
                "shipping_address": {"address": "Test address"},
            },
        )
        assert response.status_code == 200, response.text
        order = response.json()
        assert order["total_amount"] == product["price"]
        assert order["items"][0]["seller_id"] == product["seller_id"]
        assert order["items"][0]["name"] == product["name"]

