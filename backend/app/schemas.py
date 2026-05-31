from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ProductBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    sku: str = Field(min_length=1, max_length=60)
    price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    quantity: int = Field(ge=0)

    @field_validator("name", "sku")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("sku")
    @classmethod
    def normalize_sku(cls, value: str) -> str:
        return value.upper()


class ProductCreate(ProductBase):
    pass


class ProductUpdate(ProductBase):
    pass


class ProductRead(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class CustomerCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=5, max_length=30)

    @field_validator("full_name", "phone")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).lower()


class CustomerRead(CustomerCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class OrderItemCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)


class OrderCreate(BaseModel):
    customer_id: int = Field(gt=0)
    items: list[OrderItemCreate] = Field(min_length=1)

    @field_validator("items")
    @classmethod
    def require_unique_products(cls, value: list[OrderItemCreate]) -> list[OrderItemCreate]:
        ids = [item.product_id for item in value]
        if len(ids) != len(set(ids)):
            raise ValueError("each product may only appear once per order")
        return value


class OrderItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    product: ProductRead


class OrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    total_amount: Decimal
    created_at: datetime
    customer: CustomerRead
    items: list[OrderItemRead]

