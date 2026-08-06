import os
import sys
import uuid
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "perfurm_notification_test")
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret")
os.environ.setdefault("USE_MOCK_DB", "true")
os.environ.setdefault("APP_ENV", "test")

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from fastapi.testclient import TestClient
from server import app


def test_notification_outbox_materializes_jobs_idempotently_and_reports_configuration():
    suffix = uuid.uuid4().hex[:10]
    with TestClient(app) as client:
        customer = client.post("/api/auth/register", json={
            "email": f"notify-{suffix}@example.com", "password": "Secure123!",
            "name": "Notification Recipient", "phone": "9876543210", "role": "customer",
        }).json()
        admin = client.post(
            "/api/auth/login", json={"email": "admin@perfurm.com", "password": "admin123"}
        ).json()
        headers = {"Authorization": f"Bearer {admin['access_token']}"}
        broadcast = client.post("/api/admin/notifications/broadcast", headers=headers, json={
            "title": "Order update", "message": "Your parcel is being prepared.",
            "type": "order_update", "user_ids": [customer["user"]["id"]],
        })
        assert broadcast.status_code == 200, broadcast.text

        run = client.post("/api/admin/notifications/outbox/run", headers=headers)
        assert run.status_code == 200, run.text
        status = client.get("/api/admin/notifications/outbox", headers=headers)
        assert status.status_code == 200
        payload = status.json()
        assert payload["delivery_enabled"] is False
        assert payload["counts"]["blocked_configuration"] >= 2

        second_run = client.post("/api/admin/notifications/outbox/run", headers=headers)
        assert second_run.status_code == 200
        assert second_run.json()["materialized"] == 0

        customer_headers = {"Authorization": f"Bearer {customer['access_token']}"}
        before_delete = client.get("/api/notifications/my", headers=customer_headers)
        assert before_delete.status_code == 200 and len(before_delete.json()) == 1
        deleted = client.delete("/api/notifications/my", headers=customer_headers)
        assert deleted.status_code == 200 and deleted.json()["deleted_count"] == 1
        assert client.get("/api/notifications/my", headers=customer_headers).json() == []


def test_readiness_and_prometheus_metrics_are_available_in_test_environment():
    with TestClient(app) as client:
        ready = client.get("/ready")
        metrics = client.get("/metrics")
        assert ready.status_code == 200, ready.text
        assert ready.json()["checks"]["notification_worker"] is True
        assert metrics.status_code == 200
        assert metrics.headers["content-type"].startswith("text/plain")
        assert "perfurm_http_requests_total" in metrics.text
        assert "perfurm_notification_jobs" in metrics.text
