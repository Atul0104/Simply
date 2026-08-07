import os
import sys
import uuid
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "perfurm_invoice_test")
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret")
os.environ.setdefault("USE_MOCK_DB", "true")
os.environ.setdefault("APP_ENV", "test")

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from fastapi.testclient import TestClient
import server


def bearer(token, key=None):
    headers = {"Authorization": f"Bearer {token}"}
    if key:
        headers["Idempotency-Key"] = key
    return headers


def test_quote_is_authoritative_and_invoice_is_immutable_and_private():
    suffix = uuid.uuid4().hex[:10]
    with TestClient(server.app) as client:
        customer = client.post("/api/auth/register", json={
            "email": f"invoice-{suffix}@example.com", "password": "Secure123!",
            "name": "Invoice Buyer", "role": "customer",
        }).json()
        outsider = client.post("/api/auth/register", json={
            "email": f"outsider-{suffix}@example.com", "password": "Secure123!",
            "name": "Other Buyer", "role": "customer",
        }).json()
        token = customer["access_token"]
        product = next(item for item in client.get("/api/products").json() if not item.get("variants") and item["seller_id"] == "preview-atelier")
        items = [{"product_id": product["id"], "quantity": 1}]
        quote_response = client.post("/api/checkout/quote", headers=bearer(token), json={
            "items": items, "pincode": "400001", "state": "Maharashtra",
        })
        assert quote_response.status_code == 200, quote_response.text
        quote = quote_response.json()
        assert quote["subtotal"] == product["price"]
        assert quote["tax_amount"] > 0
        assert quote["cgst_amount"] + quote["sgst_amount"] == quote["tax_amount"]
        assert quote["igst_amount"] == 0
        assert quote["delivery"]["estimated_delivery_days"] == 2

        order_response = client.post("/api/orders", headers=bearer(token, f"invoice-order-{suffix}"), json={
            "items": [{**items[0], "price": 1}], "total_amount": 1,
            "payment_method": "cod",
            "shipping_address": {"name": "Invoice Buyer", "address": "1 Test Road", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001"},
        })
        assert order_response.status_code == 200, order_response.text
        order = order_response.json()
        for field in ("subtotal", "shipping_charge", "tax_amount", "cgst_amount", "sgst_amount", "igst_amount", "total_amount"):
            assert order[field] == quote[field]
        assert order["total_amount"] != 1

        first = client.post(f"/api/orders/{order['id']}/invoices", headers=bearer(token))
        second = client.post(f"/api/orders/{order['id']}/invoices", headers=bearer(token))
        assert first.status_code == 200, first.text
        assert second.status_code == 200, second.text
        assert first.json()[0]["invoice_number"] == second.json()[0]["invoice_number"]
        invoice = first.json()[0]
        assert invoice["taxable_amount"] + invoice["tax_amount"] + invoice["shipping_charge"] == invoice["total_amount"]
        assert invoice["total_amount"] == order["total_amount"]

        forbidden = client.get(f"/api/orders/{order['id']}/invoices", headers=bearer(outsider["access_token"]))
        assert forbidden.status_code == 403
        download = client.get(f"/api/orders/{order['id']}/invoice-download", headers=bearer(token))
        assert download.status_code == 200
        assert "attachment" in download.headers["content-disposition"]
        assert invoice["invoice_number"] in download.text


def test_interstate_quote_uses_igst_and_platform_tax_validation_is_bounded():
    suffix = uuid.uuid4().hex[:10]
    with TestClient(server.app) as client:
        customer = client.post("/api/auth/register", json={
            "email": f"igst-{suffix}@example.com", "password": "Secure123!",
            "name": "Interstate Buyer", "role": "customer",
        }).json()
        product = next(item for item in client.get("/api/products").json() if not item.get("variants"))
        quote = client.post("/api/checkout/quote", headers=bearer(customer["access_token"]), json={
            "items": [{"product_id": product["id"], "quantity": 1}],
            "pincode": "110001", "state": "Delhi",
        })
        assert quote.status_code == 200, quote.text
        assert quote.json()["igst_amount"] == quote.json()["tax_amount"]
        assert quote.json()["cgst_amount"] == quote.json()["sgst_amount"] == 0

        admin = client.post("/api/auth/login", json={"email": "admin@perfurm.com", "password": "admin123"}).json()
        invalid = client.put("/api/admin/platform-settings", headers=bearer(admin["access_token"]), json={"gst_percentage": 101})
        assert invalid.status_code == 422


def test_checkout_addons_use_admin_prices_and_are_persisted_in_total():
    suffix = uuid.uuid4().hex[:10]
    with TestClient(server.app) as client:
        admin = client.post("/api/auth/login", json={"email": "admin@perfurm.com", "password": "admin123"}).json()
        configured = client.put("/api/admin/platform-settings", headers=bearer(admin["access_token"]), json={
            "gift_wrap_enabled": True, "gift_wrap_price": 75,
            "sticker_enabled": True, "sticker_price": 25,
        })
        assert configured.status_code == 200
        customer = client.post("/api/auth/register", json={
            "email": f"gift-{suffix}@example.com", "password": "Secure123!", "name": "Gift Buyer", "role": "customer",
        }).json()
        product = next(item for item in client.get("/api/products").json() if not item.get("variants") and item["seller_id"] == "preview-atelier")
        items = [{"product_id": product["id"], "quantity": 1}]
        base = client.post("/api/checkout/quote", headers=bearer(customer["access_token"]), json={"items": items, "pincode": "400001", "state": "Maharashtra"}).json()
        gift = client.post("/api/checkout/quote", headers=bearer(customer["access_token"]), json={
            "items": items, "pincode": "400001", "state": "Maharashtra", "gift_wrap_selected": True, "sticker_selected": True,
        }).json()
        assert gift["gift_wrap_charge"] == 75
        assert gift["sticker_charge"] == 25
        assert gift["total_amount"] == base["total_amount"] + 100
        order = client.post("/api/orders", headers=bearer(customer["access_token"], f"gift-order-{suffix}"), json={
            "items": items, "total_amount": 1, "payment_method": "cod", "gift_wrap_selected": True, "sticker_selected": True,
            "shipping_address": {"name": "Gift Buyer", "address": "1 Test Road", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001"},
        })
        assert order.status_code == 200, order.text
        assert order.json()["total_amount"] == gift["total_amount"]
        assert order.json()["gift_wrap_selected"] is True and order.json()["sticker_selected"] is True
