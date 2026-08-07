import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "perfurm_customer_controls_test")
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret")
os.environ.setdefault("USE_MOCK_DB", "true")
os.environ.setdefault("APP_ENV", "test")

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from fastapi.testclient import TestClient
import server


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def register(client, suffix):
    return client.post("/api/auth/register", json={
        "email": f"controlled-{suffix}@example.com", "password": "Secure123!",
        "name": "Controlled Customer", "phone": "9876543210", "role": "customer",
    }).json()


def test_admin_filters_controls_and_grants_customer_credit():
    suffix = uuid.uuid4().hex[:10]
    with TestClient(server.app) as client:
        admin = client.post("/api/auth/login", json={"email": "admin@perfurm.com", "password": "admin123"}).json()
        customer = register(client, suffix)
        admin_headers = auth(admin["access_token"])
        customer_id = customer["user"]["id"]

        found = client.get("/api/admin/customers", headers=admin_headers, params={"q": customer_id, "min_orders": 0, "min_spent": 0})
        assert found.status_code == 200, found.text
        assert any(item["id"] == customer_id for item in found.json()["items"])

        credit = client.post(f"/api/admin/customers/{customer_id}/credits", headers=admin_headers, json={
            "amount": 100, "reason": "Customer care goodwill credit",
        })
        assert credit.status_code == 200, credit.text
        assert credit.json()["amount"] == 100

        blocked = client.put(f"/api/admin/customers/{customer_id}/account", headers=admin_headers, json={
            "status": "blocked", "duration_days": 7, "reason": "Automated abuse review",
        })
        assert blocked.status_code == 200, blocked.text
        login = client.post("/api/auth/login", json={"email": f"controlled-{suffix}@example.com", "password": "Secure123!"})
        assert login.status_code == 403
        assert "blocked" in login.json()["error"]["message"].lower()

        active = client.put(f"/api/admin/customers/{customer_id}/account", headers=admin_headers, json={
            "status": "active", "reason": "Manual review completed",
        })
        assert active.status_code == 200
        assert client.post("/api/auth/login", json={"email": f"controlled-{suffix}@example.com", "password": "Secure123!"}).status_code == 200


def test_targeted_coupon_is_private_and_enforced():
    suffix = uuid.uuid4().hex[:10]
    with TestClient(server.app) as client:
        admin = client.post("/api/auth/login", json={"email": "admin@perfurm.com", "password": "admin123"}).json()
        assigned = register(client, f"a-{suffix}")
        other = register(client, f"b-{suffix}")
        code = f"VIP-{suffix}"
        now = datetime.now(timezone.utc)
        created = client.post("/api/admin/coupons", headers=auth(admin["access_token"]), json={
            "code": code, "discount_type": "fixed", "discount_value": 100,
            "valid_from": (now - timedelta(minutes=1)).isoformat(), "valid_until": (now + timedelta(days=1)).isoformat(),
            "audience_type": "specific_users", "eligible_user_ids": [assigned["user"]["id"]],
        })
        assert created.status_code == 200, created.text
        assert code not in [item["code"] for item in client.get("/api/coupons/active").json()]
        mine = client.get("/api/coupons/mine", headers=auth(assigned["access_token"]))
        assert code.upper() in [item["code"] for item in mine.json()]
        assert all("eligible_user_ids" not in item for item in mine.json())
        denied = client.get(f"/api/coupons/validate/{code}", headers=auth(other["access_token"]), params={"order_amount": 1000})
        assert denied.status_code == 403


def test_current_location_uses_configured_reverse_geocoder(monkeypatch):
    class ProviderResponse:
        def raise_for_status(self): return None
        def json(self): return {"city": "Pune", "principalSubdivision": "Maharashtra", "postcode": "411001", "locality": "Camp"}
    monkeypatch.setattr(server.requests, "get", lambda *args, **kwargs: ProviderResponse())
    suffix = uuid.uuid4().hex[:10]
    with TestClient(server.app) as client:
        customer = register(client, suffix)
        response = client.get("/api/location/reverse", headers=auth(customer["access_token"]), params={"latitude": 18.52, "longitude": 73.85})
        assert response.status_code == 200, response.text
        assert response.json()["pincode"] == "411001"
        assert response.json()["state"] == "Maharashtra"


def test_admin_integration_status_never_exposes_secrets():
    with TestClient(server.app) as client:
        admin = client.post("/api/auth/login", json={"email": "admin@perfurm.com", "password": "admin123"}).json()
        response = client.get("/api/admin/integrations/status", headers=auth(admin["access_token"]))
        assert response.status_code == 200
        body = response.json()
        assert set(body["payments"]) == {"provider", "configured"}
        assert set(body["operational"]) == {
            "failed_payments", "refunds_pending", "shipping_failures",
            "notification_failures", "low_stock_variants",
        }
        assert all(isinstance(value, int) and value >= 0 for value in body["operational"].values())
        assert body["media"]["provider"] == "cloudinary"
        assert body["bot_protection"]["provider"] == "cloudflare_turnstile"
        serialized = response.text.lower()
        assert "secret" not in serialized and "password" not in serialized
