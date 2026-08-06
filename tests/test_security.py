import os
import sys
import uuid
import json
import hmac
import hashlib
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
        product = next(item for item in client.get("/api/products").json() if not item.get("variants"))
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
                "shipping_address": {"address": "Test address", "pincode": "400001"},
            },
        )
        assert response.status_code == 200, response.text
        order = response.json()
        assert order["total_amount"] == product["price"]
        assert order["items"][0]["seller_id"] == product["seller_id"]
        assert order["items"][0]["name"] == product["name"]


def test_order_creation_is_idempotent():
    with TestClient(app) as client:
        created = client.post("/api/auth/register", json=registration())
        headers = {
            "Authorization": f"Bearer {created.json()['access_token']}",
            "Idempotency-Key": f"test-{uuid.uuid4()}",
        }
        product = next(item for item in client.get("/api/products").json() if not item.get("variants"))
        payload = {
            "items": [{"product_id": product["id"], "quantity": 1}],
            "total_amount": 1,
            "shipping_address": {"address": "Test address", "pincode": "400001"},
        }
        first = client.post("/api/orders", headers=headers, json=payload)
        second = client.post("/api/orders", headers=headers, json=payload)
        assert first.status_code == 200
        assert second.status_code == 200
        assert second.json()["id"] == first.json()["id"]


def test_payment_webhook_requires_signature_and_is_idempotent():
    os.environ["RAZORPAY_WEBHOOK_SECRET"] = "webhook-test-secret"
    payload = json.dumps({"event": "payment.captured", "payload": {}}).encode()
    signature = hmac.new(b"webhook-test-secret", payload, hashlib.sha256).hexdigest()
    event_id = f"event-{uuid.uuid4()}"
    with TestClient(app) as client:
        rejected = client.post("/api/payments/webhook", content=payload)
        assert rejected.status_code == 401
        headers = {
            "X-Razorpay-Signature": signature,
            "X-Razorpay-Event-Id": event_id,
            "Content-Type": "application/json",
        }
        accepted = client.post("/api/payments/webhook", content=payload, headers=headers)
        duplicate = client.post("/api/payments/webhook", content=payload, headers=headers)
        assert accepted.status_code == 200
        assert accepted.json()["status"] == "accepted"
        assert duplicate.json()["status"] == "duplicate"


def test_refresh_session_rotates_and_logout_revokes_cookie():
    with TestClient(app) as client:
        created = client.post("/api/auth/register", json=registration())
        assert created.status_code == 200
        original_cookie = client.cookies.get("perfurm_refresh")
        assert original_cookie

        refreshed = client.post("/api/auth/refresh")
        assert refreshed.status_code == 200
        rotated_cookie = client.cookies.get("perfurm_refresh")
        assert rotated_cookie and rotated_cookie != original_cookie

        replay = TestClient(app)
        replay.cookies.set("perfurm_refresh", original_cookie, path="/api/auth")
        replayed = replay.post("/api/auth/refresh")
        assert replayed.status_code == 401

        logged_out = client.post("/api/auth/logout")
        assert logged_out.status_code == 200
        assert client.post("/api/auth/refresh").status_code == 401


def test_login_attempts_are_rate_limited_per_identity():
    email = f"missing-{uuid.uuid4()}@example.com"
    with TestClient(app) as client:
        responses = [
            client.post("/api/auth/login", json={"email": email, "password": "WrongPassword1!"})
            for _ in range(6)
        ]
        assert all(response.status_code == 401 for response in responses[:5])
        assert responses[5].status_code == 429
        assert int(responses[5].headers["retry-after"]) > 0


def test_delegated_admin_permissions_are_enforced_by_backend():
    suffix = uuid.uuid4().hex[:10]
    with TestClient(app) as client:
        super_admin = client.post(
            "/api/auth/login", json={"email": "admin@perfurm.com", "password": "admin123"}
        ).json()
        created = client.post(
            "/api/admin/staff",
            headers={"Authorization": f"Bearer {super_admin['access_token']}"},
            json={
                "email": f"analyst-{suffix}@example.com", "password": "Analyst123!",
                "name": "Read Only Analyst", "admin_role": "read_only_analyst",
            },
        )
        assert created.status_code == 200, created.text
        analyst = client.post(
            "/api/auth/login",
            json={"email": f"analyst-{suffix}@example.com", "password": "Analyst123!"},
        ).json()
        headers = {"Authorization": f"Bearer {analyst['access_token']}"}
        assert client.get("/api/analytics/admin", headers=headers).status_code == 200
        forbidden = client.get("/api/admin/ticker-messages", headers=headers)
        assert forbidden.status_code == 403
        assert forbidden.json()["error"]["required"] == "marketing.manage"
        assert client.get("/api/admin/staff", headers=headers).status_code == 403
        assert client.get("/api/admin/products", headers=headers).status_code == 403
        removed = client.delete(f"/api/admin/staff/{created.json()['id']}", headers={"Authorization": f"Bearer {super_admin['access_token']}"})
        assert removed.status_code == 200
        assert client.post("/api/auth/login", json={"email": f"analyst-{suffix}@example.com", "password": "Analyst123!"}).status_code == 401
        assert client.delete(f"/api/admin/staff/{super_admin['user']['id']}", headers={"Authorization": f"Bearer {super_admin['access_token']}"}).status_code == 409


def test_product_manager_can_curate_but_not_self_provision_staff():
    suffix = uuid.uuid4().hex[:10]
    with TestClient(app) as client:
        owner = client.post(
            "/api/auth/login", json={"email": "admin@perfurm.com", "password": "admin123"}
        ).json()
        owner_headers = {"Authorization": f"Bearer {owner['access_token']}"}
        created = client.post(
            "/api/admin/staff", headers=owner_headers,
            json={
                "email": f"product-manager-{suffix}@example.com", "password": "Product123!",
                "name": "Catalogue Curator", "admin_role": "product_manager",
            },
        )
        assert created.status_code == 200, created.text
        login = client.post(
            "/api/auth/login",
            json={"email": f"product-manager-{suffix}@example.com", "password": "Product123!"},
        ).json()
        headers = {"Authorization": f"Bearer {login['access_token']}"}
        catalogue = client.get("/api/admin/products", headers=headers, params={"page_size": 1})
        assert catalogue.status_code == 200, catalogue.text
        product = catalogue.json()["items"][0]
        curated = client.patch(
            f"/api/admin/products/{product['id']}/merchandising",
            headers=headers, json={"is_featured": True},
        )
        assert curated.status_code == 200, curated.text
        assert curated.json()["is_featured"] is True
        assert client.get("/api/admin/staff", headers=headers).status_code == 403


def test_super_admin_customer_management_returns_safe_order_summary():
    with TestClient(app) as client:
        owner = client.post("/api/auth/login", json={"email": "admin@perfurm.com", "password": "admin123"}).json()
        response = client.get("/api/admin/customers", headers={"Authorization": f"Bearer {owner['access_token']}"}, params={"q": "Preview Customer", "page_size": 10})
        assert response.status_code == 200, response.text
        payload = response.json(); assert payload["total"] == 1
        customer = payload["items"][0]
        assert customer["email"] == "customer@example.com" and customer["phone"] == "9000000003"
        assert "password_hash" not in customer
        assert set(customer["order_stats"]) == {"total", "cancelled", "delivered", "active", "total_spent", "last_order_at"}
        assert set(customer["location"]) == {"city", "state", "pincode"}
