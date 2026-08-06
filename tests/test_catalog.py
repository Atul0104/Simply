import os
import sys
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "perfurm_catalog_test")
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret")
os.environ.setdefault("USE_MOCK_DB", "true")
os.environ.setdefault("APP_ENV", "test")

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from fastapi.testclient import TestClient
from server import app


def test_catalog_is_paginated_and_hides_cost_price():
    with TestClient(app) as client:
        response = client.get("/api/catalog/products", params={"page": 1, "page_size": 3})
        assert response.status_code == 200
        payload = response.json()
        assert payload["page"] == 1
        assert payload["page_size"] == 3
        assert payload["total"] >= 3
        assert len(payload["items"]) == 3
        assert all("cost_price" not in item for item in payload["items"])


def test_all_public_product_endpoints_hide_commercial_costs():
    with TestClient(app) as client:
        listing = client.get("/api/products")
        assert listing.status_code == 200
        assert listing.json()
        product = listing.json()[0]
        assert "cost_price" not in product
        assert all("cost_price" not in variant for variant in product.get("variants", []))

        detail = client.get(f"/api/products/{product['id']}")
        assert detail.status_code == 200
        assert "cost_price" not in detail.json()
        assert all("cost_price" not in variant for variant in detail.json().get("variants", []))

        search = client.get("/api/search", params={"q": product["name"]})
        assert search.status_code == 200
        assert all("cost_price" not in item for item in search.json())

        trending = client.get("/api/products/trending", params={"limit": 2})
        assert trending.status_code == 200
        assert all("cost_price" not in item for item in trending.json())


def test_catalog_combines_filters_and_sorting():
    with TestClient(app) as client:
        response = client.get(
            "/api/catalog/products",
            params=[("fragrance_family", "Woody"), ("target", "Men"), ("sort", "price_low")],
        )
        assert response.status_code == 200
        items = response.json()["items"]
        assert items
        assert all(item["fragrance_family"] == "Woody" for item in items)
        assert all(item["target_category"] == "Men" for item in items)
        assert [item["price"] for item in items] == sorted(item["price"] for item in items)


def test_catalog_rejects_unknown_sort_and_sets_security_headers():
    with TestClient(app) as client:
        response = client.get("/api/catalog/products", params={"sort": "unsafe"})
        assert response.status_code == 422
        assert response.json()["request_id"]
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["x-frame-options"] == "DENY"


def test_bestseller_route_is_not_shadowed_by_product_detail():
    with TestClient(app) as client:
        response = client.get("/api/catalog/bestsellers", params={"limit": 4})
        assert response.status_code == 200
        assert len(response.json()) == 4


def test_sitemap_and_robots_publish_catalogue_urls_and_hide_private_routes():
    with TestClient(app) as client:
        sitemap = client.get("/sitemap.xml")
        robots = client.get("/robots.txt")
        assert sitemap.status_code == 200
        assert sitemap.headers["content-type"].startswith("application/xml")
        assert "/customer/product/" in sitemap.text
        assert "Disallow: /admin" in robots.text
        assert "Sitemap:" in robots.text


def test_serviceability_fails_closed_for_unconfigured_pincode():
    with TestClient(app) as client:
        configured = client.get("/api/pincode/400001")
        unavailable = client.get("/api/pincode/999999")
        assert configured.json()["delivery_available"] is True
        assert unavailable.status_code == 200
        assert unavailable.json() == {
            "pincode": "999999", "delivery_available": False, "cod_available": False
        }


def test_admin_serviceability_list_is_searchable_and_paginated():
    with TestClient(app) as client:
        login = client.post(
            "/api/auth/login", json={"email": "admin@perfurm.com", "password": "admin123"}
        )
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        response = client.get(
            "/api/admin/pincode-rules",
            params={"q": "Mumbai", "page": 1, "page_size": 2},
            headers=headers,
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["page"] == 1
        assert payload["page_size"] == 2
        assert payload["total"] >= 1
        assert len(payload["items"]) <= 2
        assert all("mumbai" in item["city"].lower() for item in payload["items"])
