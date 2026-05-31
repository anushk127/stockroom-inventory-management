import os

os.environ["DATABASE_URL"] = "sqlite:///./test_inventory.db"

from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app


def setup_function():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_order_creation_reduces_stock_and_delete_restores_it():
    with TestClient(app) as client:
        product = client.post(
            "/products",
            json={"name": "Monitor", "sku": "MON-1", "price": "125.50", "quantity": 5},
        ).json()
        customer = client.post(
            "/customers",
            json={"full_name": "Ada Lovelace", "email": "ada@example.com", "phone": "+1 555 0100"},
        ).json()

        response = client.post(
            "/orders",
            json={"customer_id": customer["id"], "items": [{"product_id": product["id"], "quantity": 2}]},
        )
        assert response.status_code == 201
        order = response.json()
        assert order["total_amount"] == "251.00"
        assert client.get(f"/products/{product['id']}").json()["quantity"] == 3

        assert client.delete(f"/orders/{order['id']}").status_code == 204
        assert client.get(f"/products/{product['id']}").json()["quantity"] == 5


def test_rejects_duplicate_sku_email_and_insufficient_stock():
    with TestClient(app) as client:
        product = client.post(
            "/products",
            json={"name": "Keyboard", "sku": "KEY-1", "price": "50", "quantity": 1},
        ).json()
        assert client.post(
            "/products",
            json={"name": "Other", "sku": "key-1", "price": "5", "quantity": 1},
        ).status_code == 409

        customer = client.post(
            "/customers",
            json={"full_name": "Grace Hopper", "email": "grace@example.com", "phone": "555-0101"},
        ).json()
        assert client.post(
            "/customers",
            json={"full_name": "Other", "email": "GRACE@example.com", "phone": "555-0102"},
        ).status_code == 409
        assert client.post(
            "/orders",
            json={"customer_id": customer["id"], "items": [{"product_id": product["id"], "quantity": 2}]},
        ).status_code == 409

