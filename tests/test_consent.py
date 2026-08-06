import uuid
from fastapi.testclient import TestClient
from backend.server import app


def payload(config, **preferences):
    return {
        "preferences": {"necessary": True, "functional": False, "analytics": False, "marketing": False, "personalization": False, **preferences},
        "anonymous_id": f"visitor-{uuid.uuid4()}", "source": "banner",
        "consent_policy_version": config["consent_policy_version"],
        "cookie_policy_version": config["cookie_policy_version"],
        "privacy_policy_version": config["privacy_policy_version"],
    }


def test_consent_is_deny_by_default_and_versioned():
    with TestClient(app) as client:
        config_response = client.get("/api/privacy/consent/config")
        assert config_response.status_code == 200
        config = config_response.json()
        assert config["necessary"] == {"enabled": True, "mutable": False}
        decision = client.post("/api/privacy/consent", json=payload(config))
        assert decision.status_code == 201
        assert decision.json()["preferences"] == {"necessary": True, "functional": False, "analytics": False, "marketing": False, "personalization": False}
        stale = payload(config)
        stale["consent_policy_version"] = "obsolete"
        assert client.post("/api/privacy/consent", json=stale).status_code == 409


def test_necessary_consent_cannot_be_disabled():
    with TestClient(app) as client:
        config = client.get("/api/privacy/consent/config").json()
        invalid = payload(config)
        invalid["preferences"]["necessary"] = False
        assert client.post("/api/privacy/consent", json=invalid).status_code == 422


def test_refresh_rejects_missing_csrf_header():
    unique = uuid.uuid4()
    with TestClient(app) as client:
        created = client.post("/api/auth/register", json={"email": f"csrf-{unique}@example.com", "password": "StrongPass1!", "name": "CSRF Test", "phone": "9876543210", "role": "customer"})
        assert created.status_code == 200
        assert client.post("/api/auth/refresh").status_code == 403
