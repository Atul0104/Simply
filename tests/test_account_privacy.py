import os
import sys
import uuid
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "perfurm_privacy_test")
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret")
os.environ.setdefault("USE_MOCK_DB", "true")
os.environ.setdefault("APP_ENV", "test")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from fastapi.testclient import TestClient
import server


def bearer(token): return {"Authorization": f"Bearer {token}"}


def test_data_export_deletion_request_and_password_rotation():
    suffix = uuid.uuid4().hex[:10]
    email = f"privacy-{suffix}@example.com"
    old_password, new_password = "Secure123!", "NewSecure456!"
    with TestClient(server.app) as client:
        registered = client.post("/api/auth/register", json={"email": email, "password": old_password, "name": "Privacy Buyer", "role": "customer"})
        assert registered.status_code == 200, registered.text
        token = registered.json()["access_token"]
        exported = client.get("/api/profile/data-export", headers=bearer(token))
        assert exported.status_code == 200, exported.text
        assert exported.json()["profile"]["email"] == email
        assert "password_hash" not in exported.text and "internal_notes" not in exported.text

        wrong = client.post("/api/profile/deletion-request", headers=bearer(token), json={"password": "WrongPassword!", "reason": "Testing privacy"})
        assert wrong.status_code == 400
        deletion = client.post("/api/profile/deletion-request", headers=bearer(token), json={"password": old_password, "reason": "Testing privacy"})
        assert deletion.status_code == 200, deletion.text
        assert deletion.json()["status"] == "pending" and "email" not in deletion.json()
        assert client.post("/api/profile/deletion-request", headers=bearer(token), json={"password": old_password}).status_code == 409

        changed = client.post("/api/profile/change-password", headers=bearer(token), json={"current_password": old_password, "new_password": new_password})
        assert changed.status_code == 200, changed.text
        assert client.post("/api/auth/login", json={"email": email, "password": old_password}).status_code == 401
        assert client.post("/api/auth/login", json={"email": email, "password": new_password}).status_code == 200


def test_privacy_queue_permissions_retention_and_irreversible_anonymization():
    suffix = uuid.uuid4().hex[:10]
    email, password = f"erase-{suffix}@example.com", "Secure123!"
    old_grace, old_retention = server.ACCOUNT_DELETION_GRACE_DAYS, server.ORDER_PII_RETENTION_DAYS
    server.ACCOUNT_DELETION_GRACE_DAYS = 0; server.ORDER_PII_RETENTION_DAYS = 0
    try:
        with TestClient(server.app) as client:
            super_admin = client.post("/api/auth/login", json={"email": "admin@perfurm.com", "password": "admin123"}).json()
            standard_email = f"privacy-admin-{suffix}@example.com"
            created_admin = client.post("/api/admin/staff", headers=bearer(super_admin["access_token"]), json={"email": standard_email, "password": "AdminSecure123!", "name": "Privacy Admin", "admin_role": "admin"})
            assert created_admin.status_code == 200, created_admin.text
            standard_admin = client.post("/api/auth/login", json={"email": standard_email, "password": "AdminSecure123!"}).json()
            analyst_email = f"privacy-analyst-{suffix}@example.com"
            client.post("/api/admin/staff", headers=bearer(super_admin["access_token"]), json={"email": analyst_email, "password": "Analyst123!", "name": "Privacy Analyst", "admin_role": "read_only_analyst"})
            analyst = client.post("/api/auth/login", json={"email": analyst_email, "password": "Analyst123!"}).json()
            customer = client.post("/api/auth/register", json={"email": email, "password": password, "name": "Erase Buyer", "role": "customer"}).json()
            token, customer_id = customer["access_token"], customer["user"]["id"]
            request = client.post("/api/profile/deletion-request", headers=bearer(token), json={"password": password, "reason": "Please remove my account"}).json()
            assert client.get("/api/admin/privacy/deletion-requests", headers=bearer(analyst["access_token"])).status_code == 403
            queue = client.get("/api/admin/privacy/deletion-requests", params={"status": "pending"}, headers=bearer(standard_admin["access_token"]))
            assert any(item["id"] == request["id"] for item in queue.json()["items"])
            approved = client.patch(f"/api/admin/privacy/deletion-requests/{request['id']}", headers=bearer(standard_admin["access_token"]), json={"status": "approved", "notes": "Identity confirmed and retention reviewed"})
            assert approved.status_code == 200, approved.text
            assert approved.json()["status"] == "approved" and "email" not in approved.json()
            assert client.post("/api/orders", headers={**bearer(token), "Idempotency-Key": suffix}, json={"items": [], "total_amount": 0, "shipping_address": {"pincode": "400001"}}).status_code == 409
            assert client.post(f"/api/admin/privacy/deletion-requests/{request['id']}/fulfill", headers=bearer(standard_admin["access_token"])).status_code == 403
            fulfilled = client.post(f"/api/admin/privacy/deletion-requests/{request['id']}/fulfill", headers=bearer(super_admin["access_token"]))
            assert fulfilled.status_code == 200, fulfilled.text
            assert client.get("/api/profile", headers=bearer(token)).status_code == 401
            assert client.post("/api/auth/login", json={"email": email, "password": password}).status_code == 401
            users = client.get("/api/admin/users", headers=bearer(super_admin["access_token"])).json()
            anonymized = next(item for item in users if item["id"] == customer_id)
            assert anonymized["name"] == "Deleted Customer" and anonymized["is_active"] is False
    finally:
        server.ACCOUNT_DELETION_GRACE_DAYS, server.ORDER_PII_RETENTION_DAYS = old_grace, old_retention
