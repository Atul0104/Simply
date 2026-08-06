import hashlib
import hmac
import json
import os
import sys
import uuid
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "perfurm_payment_test")
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret")
os.environ.setdefault("USE_MOCK_DB", "true")
os.environ.setdefault("APP_ENV", "test")
os.environ["RAZORPAY_WEBHOOK_SECRET"] = "payment-webhook-test"

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from fastapi.testclient import TestClient
import server


class FakeOrders:
    def __init__(self, provider_order_id):
        self.provider_order_id = provider_order_id

    def create(self, payload):
        return {"id": self.provider_order_id, **payload}


class FakePayments:
    def __init__(self, refund_id):
        self.refund_id = refund_id

    def refund(self, payment_id, payload):
        return {"id": self.refund_id, "payment_id": payment_id, "status": "pending", **payload}


class FakeUtility:
    def verify_payment_signature(self, payload):
        return True


class FakeRazorpay:
    def __init__(self, provider_order_id, refund_id):
        self.order = FakeOrders(provider_order_id)
        self.payment = FakePayments(refund_id)
        self.utility = FakeUtility()


def bearer(token, idempotency=None):
    headers = {"Authorization": f"Bearer {token}"}
    if idempotency:
        headers["Idempotency-Key"] = idempotency
    return headers


def signed_webhook(client, payload, event_id):
    body = json.dumps(payload).encode()
    signature = hmac.new(b"payment-webhook-test", body, hashlib.sha256).hexdigest()
    return client.post(
        "/api/payments/webhook", content=body,
        headers={
            "Content-Type": "application/json", "X-Razorpay-Signature": signature,
            "X-Razorpay-Event-Id": event_id,
        },
    )


def test_partial_refund_is_authorized_idempotent_and_webhook_reconciled():
    suffix = uuid.uuid4().hex[:10]
    provider_order_id = f"order_{suffix}"
    payment_id = f"pay_{suffix}"
    refund_id = f"rfnd_{suffix}"
    original_client = server.razorpay_client
    server.razorpay_client = FakeRazorpay(provider_order_id, refund_id)
    try:
        with TestClient(server.app) as client:
            customer = client.post("/api/auth/register", json={
                "email": f"payment-{suffix}@example.com", "password": "Secure123!",
                "name": "Payment Buyer", "role": "customer",
            }).json()
            customer_headers = bearer(customer["access_token"], f"payment-order-{suffix}")
            product = next(item for item in client.get("/api/products").json() if not item.get("variants") and item["seller_id"] == "preview-atelier")
            order = client.post("/api/orders", headers=customer_headers, json={
                "items": [{"product_id": product["id"], "quantity": 1}],
                "total_amount": 1, "payment_method": "online",
                "shipping_address": {"address": "Test address", "pincode": "400001"},
            }).json()
            payment_order = client.post(
                "/api/payments/create-order", headers=bearer(customer["access_token"]),
                json={"amount": 1, "order_id": order["id"]},
            )
            assert payment_order.status_code == 200

            captured = signed_webhook(client, {
                "event": "payment.captured",
                "payload": {"payment": {"entity": {"id": payment_id, "order_id": provider_order_id}}},
            }, f"capture-{suffix}")
            assert captured.status_code == 200

            admin = client.post(
                "/api/auth/login", json={"email": "admin@perfurm.com", "password": "admin123"}
            ).json()
            refund_headers = bearer(admin["access_token"], f"refund-key-{suffix}")
            amount = round(product["price"] / 2, 2)
            first_refund = client.post(
                f"/api/admin/orders/{order['id']}/refund", headers=refund_headers,
                json={"amount": amount, "reason": "Customer approved partial return"},
            )
            duplicate_refund = client.post(
                f"/api/admin/orders/{order['id']}/refund", headers=refund_headers,
                json={"amount": amount, "reason": "Customer approved partial return"},
            )
            assert first_refund.status_code == 200, first_refund.text
            assert duplicate_refund.json()["id"] == first_refund.json()["id"]

            processed = signed_webhook(client, {
                "event": "refund.processed",
                "payload": {"refund": {"entity": {
                    "id": refund_id, "payment_id": payment_id,
                    "amount": int(amount * 100), "status": "processed",
                }}},
            }, f"refund-{suffix}")
            assert processed.status_code == 200, processed.text

            order_after = client.get(
                f"/api/orders/{order['id']}", headers=bearer(customer["access_token"])
            ).json()
            assert order_after["payment_status"] == "partially_refunded"
            refunds = client.get(
                f"/api/admin/orders/{order['id']}/refunds", headers=bearer(admin["access_token"])
            ).json()
            assert refunds[0]["status"] == "processed"
    finally:
        server.razorpay_client = original_client


def test_failed_payment_webhook_releases_reserved_inventory():
    suffix = uuid.uuid4().hex[:10]
    provider_order_id = f"order_failed_{suffix}"
    original_client = server.razorpay_client
    server.razorpay_client = FakeRazorpay(provider_order_id, f"rfnd_unused_{suffix}")
    try:
        with TestClient(server.app) as client:
            customer = client.post("/api/auth/register", json={
                "email": f"failed-payment-{suffix}@example.com", "password": "Secure123!",
                "name": "Failed Payment Buyer", "role": "customer",
            }).json()
            seller = client.post(
                "/api/auth/login", json={"email": "seller1@example.com", "password": "seller123"}
            ).json()
            product = next(item for item in client.get("/api/products").json() if not item.get("variants") and item["seller_id"] == "preview-atelier")
            seller_headers = bearer(seller["access_token"])
            before = next(
                item for item in client.get("/api/inventory/my", headers=seller_headers).json()
                if item["product_id"] == product["id"]
            )["quantity"]
            order = client.post(
                "/api/orders", headers=bearer(customer["access_token"], f"failed-order-{suffix}"),
                json={
                    "items": [{"product_id": product["id"], "quantity": 1}],
                    "payment_method": "online", "total_amount": 1,
                    "shipping_address": {"address": "Test address", "pincode": "400001"},
                },
            ).json()
            assert order["reservation_status"] == "reserved"
            client.post(
                "/api/payments/create-order", headers=bearer(customer["access_token"]),
                json={"amount": 1, "order_id": order["id"]},
            )

            failed = signed_webhook(client, {
                "event": "payment.failed",
                "payload": {"payment": {"entity": {"id": f"pay_failed_{suffix}", "order_id": provider_order_id}}},
            }, f"failed-event-{suffix}")
            assert failed.status_code == 200, failed.text
            order_after = client.get(
                f"/api/orders/{order['id']}", headers=bearer(customer["access_token"])
            ).json()
            assert order_after["payment_status"] == "failed"
            assert order_after["reservation_status"] == "released"
            after = next(
                item for item in client.get("/api/inventory/my", headers=seller_headers).json()
                if item["product_id"] == product["id"]
            )["quantity"]
            assert after == before
    finally:
        server.razorpay_client = original_client
