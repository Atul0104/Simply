import os
import sys
import uuid
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "perfurm_admin_catalogue_test")
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret")
os.environ.setdefault("USE_MOCK_DB", "true")
os.environ.setdefault("APP_ENV", "test")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from fastapi.testclient import TestClient
from server import app


def test_admin_can_create_edit_stock_and_deactivate_single_brand_product():
    suffix = uuid.uuid4().hex[:10]
    with TestClient(app) as client:
        login = client.post("/api/auth/login", json={"email": "admin@perfurm.com", "password": "admin123"})
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        payload = {
            "name": f"Admin Amber {suffix}", "brand": "Perfurm", "description": "Single-brand admin product workflow.",
            "category": "Unisex", "target_category": "Unisex", "price": 790, "mrp": 990,
            "is_coming_soon": True,
            "sku": f"ADM-{suffix}", "images": ["https://example.com/admin-amber.jpg"],
            "variants": [{"sku": f"ADM-{suffix}-10", "size_ml": 10, "label": "10 ml", "price": 790, "mrp": 990, "stock_quantity": 8, "low_stock_limit": 3}],
        }
        created = client.post("/api/admin/catalogue/products", headers=headers, json=payload)
        assert created.status_code == 200, created.text
        product = created.json(); variant = product["variants"][0]
        assert product["is_coming_soon"] is True
        regular_catalogue = client.get("/api/catalog/products", params={"q": suffix}).json()
        coming_catalogue = client.get("/api/catalog/products", params={"q": suffix, "coming_soon": True}).json()
        assert regular_catalogue["total"] == 0 and coming_catalogue["total"] == 1

        listing = client.get("/api/admin/catalogue/products", headers=headers, params={"q": suffix})
        assert listing.status_code == 200 and listing.json()["total"] == 1
        assert listing.json()["items"][0]["cost_price"] is None

        stock = client.get("/api/admin/inventory/variants", headers=headers, params={"q": suffix})
        assert stock.status_code == 200 and stock.json()["total"] == 1
        assert stock.json()["items"][0]["stock_quantity"] == 8

        adjusted = client.put(f"/api/admin/inventory/variants/{variant['id']}", headers=headers, json={"stock_quantity": 15, "low_stock_threshold": 4})
        assert adjusted.status_code == 200, adjusted.text
        assert adjusted.json()["stock_quantity"] == 15 and adjusted.json()["available_quantity"] == 15

        payload["short_description"] = "Edited by Admin"
        payload["variants"] = product["variants"]
        updated = client.put(f"/api/admin/catalogue/products/{product['id']}", headers=headers, json=payload)
        assert updated.status_code == 200 and updated.json()["short_description"] == "Edited by Admin"

        deactivated = client.delete(f"/api/admin/catalogue/products/{product['id']}", headers=headers)
        assert deactivated.status_code == 200
        public = client.get(f"/api/products/{product['id']}")
        assert public.status_code == 200 and public.json()["is_active"] is False
