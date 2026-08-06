import os
import sys
import uuid
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "perfurm_return_test")
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


def transition_order(client, order_id, token, statuses):
    for status in statuses:
        response = client.put(
            f"/api/orders/{order_id}/status", params={"status": status}, headers=bearer(token),
        )
        assert response.status_code == 200, response.text


def test_return_eligibility_state_machine_authorization_and_restock():
    suffix = uuid.uuid4().hex[:10]
    with TestClient(server.app) as client:
        admin = client.post(
            "/api/auth/login", json={"email": "admin@perfurm.com", "password": "admin123"},
        ).json()
        seller = client.post(
            "/api/auth/login", json={"email": "seller1@example.com", "password": "seller123"},
        ).json()
        customer = client.post("/api/auth/register", json={
            "email": f"returns-{suffix}@example.com", "password": "Secure123!",
            "name": "Return Buyer", "role": "customer",
        }).json()
        outsider = client.post("/api/auth/register", json={
            "email": f"returns-outsider-{suffix}@example.com", "password": "Secure123!",
            "name": "Other Buyer", "role": "customer",
        }).json()
        analyst_email = f"return-analyst-{suffix}@example.com"
        analyst_created = client.post("/api/admin/staff", headers=bearer(admin["access_token"]), json={
            "email": analyst_email, "password": "Analyst123!", "name": "Return Analyst",
            "admin_role": "read_only_analyst",
        })
        assert analyst_created.status_code == 200, analyst_created.text
        analyst = client.post("/api/auth/login", json={"email": analyst_email, "password": "Analyst123!"}).json()
        denied_queue = client.get("/api/admin/return-requests", headers=bearer(analyst["access_token"]))
        assert denied_queue.status_code == 403
        product = next(item for item in client.get("/api/products").json() if not item.get("variants") and item["seller_id"] == "preview-atelier")
        before = next(
            row for row in client.get("/api/inventory/my", headers=bearer(seller["access_token"])).json()
            if row["product_id"] == product["id"]
        )["quantity"]
        order_response = client.post(
            "/api/orders", headers=bearer(customer["access_token"], f"return-order-{suffix}"),
            json={
                "items": [{"product_id": product["id"], "quantity": 1}], "total_amount": 1,
                "payment_method": "cod", "shipping_address": {"address": "Test", "pincode": "400001"},
            },
        )
        assert order_response.status_code == 200, order_response.text
        order = order_response.json()

        early = client.post("/api/return-requests", headers=bearer(customer["access_token"]), json={
            "order_id": order["id"], "request_type": "return", "reason": "The fragrance arrived damaged",
        })
        assert early.status_code == 409

        transition_order(client, order["id"], admin["access_token"], [
            "processing", "packed", "ready_for_shipment", "shipped", "out_for_delivery", "delivered",
        ])
        created = client.post("/api/return-requests", headers=bearer(customer["access_token"]), json={
            "order_id": order["id"], "request_type": "return", "reason": "The fragrance arrived damaged",
        })
        assert created.status_code == 200, created.text
        request = created.json()
        assert request["eligible_refund_amount"] == order["subtotal"] - order["discount_amount"]
        assert request["item_snapshot"][0]["product_id"] == product["id"]

        duplicate = client.post("/api/return-requests", headers=bearer(customer["access_token"]), json={
            "order_id": order["id"], "request_type": "replacement", "reason": "Please replace this damaged bottle",
        })
        assert duplicate.status_code == 409
        forbidden = client.put(
            f"/api/return-requests/{request['id']}/status", headers=bearer(outsider["access_token"]),
            json={"status": "approved"},
        )
        assert forbidden.status_code == 403

        queue = client.get("/api/admin/return-requests", headers=bearer(admin["access_token"]), params={"status": "pending"})
        assert queue.status_code == 200, queue.text
        assert any(item["id"] == request["id"] for item in queue.json()["items"])

        for status in ("approved", "pickup_scheduled"):
            updated = client.put(
                f"/api/return-requests/{request['id']}/status", headers=bearer(admin["access_token"]),
                json={"status": status, "admin_remarks": "Validated by operations"},
            )
            assert updated.status_code == 200, updated.text
        missing_disposition = client.put(
            f"/api/return-requests/{request['id']}/status", headers=bearer(admin["access_token"]),
            json={"status": "received"},
        )
        assert missing_disposition.status_code == 422
        received = client.put(
            f"/api/return-requests/{request['id']}/status", headers=bearer(admin["access_token"]),
            json={"status": "received", "inventory_disposition": "restock"},
        )
        assert received.status_code == 200, received.text
        assert received.json()["inventory_disposition"] == "restock"
        completed = client.put(
            f"/api/return-requests/{request['id']}/status", headers=bearer(admin["access_token"]),
            json={"status": "completed"},
        )
        assert completed.status_code == 200, completed.text

        after = next(
            row for row in client.get("/api/inventory/my", headers=bearer(seller["access_token"])).json()
            if row["product_id"] == product["id"]
        )["quantity"]
        assert after == before
        movements = client.get("/api/inventory/movements", headers=bearer(seller["access_token"])).json()["items"]
        assert any(row.get("order_id") == order["id"] and row["type"] == "return_restock" for row in movements)


def test_customer_cancellation_request_restores_stock_once_after_approval():
    suffix = uuid.uuid4().hex[:10]
    with TestClient(server.app) as client:
        admin = client.post(
            "/api/auth/login", json={"email": "admin@perfurm.com", "password": "admin123"},
        ).json()
        seller = client.post(
            "/api/auth/login", json={"email": "seller1@example.com", "password": "seller123"},
        ).json()
        customer = client.post("/api/auth/register", json={
            "email": f"cancel-{suffix}@example.com", "password": "Secure123!",
            "name": "Cancel Buyer", "role": "customer",
        }).json()
        product = next(item for item in client.get("/api/products").json() if not item.get("variants") and item["seller_id"] == "preview-atelier")
        before = next(
            row for row in client.get("/api/inventory/my", headers=bearer(seller["access_token"])).json()
            if row["product_id"] == product["id"]
        )["quantity"]
        order = client.post(
            "/api/orders", headers=bearer(customer["access_token"], f"cancel-order-{suffix}"), json={
                "items": [{"product_id": product["id"], "quantity": 1}], "total_amount": 1,
                "payment_method": "cod", "shipping_address": {"address": "Test", "pincode": "400001"},
            },
        ).json()
        request = client.post("/api/return-requests", headers=bearer(customer["access_token"]), json={
            "order_id": order["id"], "request_type": "cancel", "reason": "I placed this order by mistake",
        })
        assert request.status_code == 200, request.text
        approved = client.put(
            f"/api/return-requests/{request.json()['id']}/status", headers=bearer(admin["access_token"]),
            json={"status": "approved"},
        )
        assert approved.status_code == 200, approved.text
        order_after = client.get(f"/api/orders/{order['id']}", headers=bearer(customer["access_token"])).json()
        assert order_after["status"] == "cancelled"
        inventory_after = next(
            row for row in client.get("/api/inventory/my", headers=bearer(seller["access_token"])).json()
            if row["product_id"] == product["id"]
        )["quantity"]
        assert inventory_after == before
        repeated = client.put(
            f"/api/return-requests/{request.json()['id']}/status", headers=bearer(admin["access_token"]),
            json={"status": "approved"},
        )
        assert repeated.status_code == 200
        inventory_repeat = next(
            row for row in client.get("/api/inventory/my", headers=bearer(seller["access_token"])).json()
            if row["product_id"] == product["id"]
        )["quantity"]
        assert inventory_repeat == before
