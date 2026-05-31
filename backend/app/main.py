import os
from contextlib import asynccontextmanager
from decimal import Decimal

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from .database import Base, engine, get_db
from .models import Customer, Order, OrderItem, Product
from .schemas import (
    CustomerCreate,
    CustomerRead,
    OrderCreate,
    OrderRead,
    ProductCreate,
    ProductRead,
    ProductUpdate,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Inventory & Order Management API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def not_found(entity: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{entity} not found")


def conflict(message: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message)


def find_product(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if not product:
        raise not_found("Product")
    return product


def find_customer(db: Session, customer_id: int) -> Customer:
    customer = db.get(Customer, customer_id)
    if not customer:
        raise not_found("Customer")
    return customer


def order_query():
    return select(Order).options(
        selectinload(Order.customer),
        selectinload(Order.items).selectinload(OrderItem.product),
    )


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/products", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    product = Product(**payload.model_dump())
    db.add(product)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise conflict("A product with this SKU already exists")
    db.refresh(product)
    return product


@app.get("/products", response_model=list[ProductRead])
def list_products(db: Session = Depends(get_db)):
    return db.scalars(select(Product).order_by(Product.id.desc())).all()


@app.get("/products/{product_id}", response_model=ProductRead)
def get_product(product_id: int, db: Session = Depends(get_db)):
    return find_product(db, product_id)


@app.put("/products/{product_id}", response_model=ProductRead)
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    product = find_product(db, product_id)
    for key, value in payload.model_dump().items():
        setattr(product, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise conflict("A product with this SKU already exists")
    db.refresh(product)
    return product


@app.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = find_product(db, product_id)
    if db.scalar(select(OrderItem.id).where(OrderItem.product_id == product_id).limit(1)):
        raise conflict("Products referenced by orders cannot be deleted")
    db.delete(product)
    db.commit()


@app.post("/customers", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    customer = Customer(**payload.model_dump())
    db.add(customer)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise conflict("A customer with this email already exists")
    db.refresh(customer)
    return customer


@app.get("/customers", response_model=list[CustomerRead])
def list_customers(db: Session = Depends(get_db)):
    return db.scalars(select(Customer).order_by(Customer.id.desc())).all()


@app.get("/customers/{customer_id}", response_model=CustomerRead)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    return find_customer(db, customer_id)


@app.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = find_customer(db, customer_id)
    if db.scalar(select(Order.id).where(Order.customer_id == customer_id).limit(1)):
        raise conflict("Customers with orders cannot be deleted")
    db.delete(customer)
    db.commit()


@app.post("/orders", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    find_customer(db, payload.customer_id)
    requested_ids = [item.product_id for item in payload.items]
    products = db.scalars(
        select(Product).where(Product.id.in_(requested_ids)).with_for_update()
    ).all()
    products_by_id = {product.id: product for product in products}
    total = Decimal("0.00")

    for item in payload.items:
        product = products_by_id.get(item.product_id)
        if not product:
            raise not_found("Product")
        if product.quantity < item.quantity:
            raise conflict(f"Insufficient stock for {product.name}")
        product.quantity -= item.quantity
        total += product.price * item.quantity

    order = Order(customer_id=payload.customer_id, total_amount=total)
    order.items = [
        OrderItem(
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=products_by_id[item.product_id].price,
        )
        for item in payload.items
    ]
    db.add(order)
    db.commit()
    return db.scalar(order_query().where(Order.id == order.id))


@app.get("/orders", response_model=list[OrderRead])
def list_orders(db: Session = Depends(get_db)):
    return db.scalars(order_query().order_by(Order.id.desc())).all()


@app.get("/orders/{order_id}", response_model=OrderRead)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.scalar(order_query().where(Order.id == order_id))
    if not order:
        raise not_found("Order")
    return order


@app.delete("/orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = db.scalar(order_query().where(Order.id == order_id))
    if not order:
        raise not_found("Order")
    for item in order.items:
        item.product.quantity += item.quantity
    db.delete(order)
    db.commit()

