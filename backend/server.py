from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, File, UploadFile, Query, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict, model_validator
from typing import List, Optional, Dict, Any, Literal
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import razorpay
import re
import hmac
import hashlib
import json
import secrets
import asyncio
import smtplib
import ssl
import time
from collections import defaultdict
from email.message import EmailMessage
import requests
import xml.etree.ElementTree as ET
import html
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
import certifi
mongo_url = os.environ["MONGO_URL"]
USE_MOCK_DB = os.environ.get("USE_MOCK_DB", "false").lower() == "true"
APP_ENV = os.environ.get("APP_ENV", "development").lower()
PUBLIC_SITE_URL = os.environ.get("PUBLIC_SITE_URL", "http://localhost:3000").rstrip("/")
PUBLIC_API_URL = os.environ.get("PUBLIC_API_URL", "http://localhost:8000").rstrip("/")
PAYMENT_RESERVATION_MINUTES = int(os.environ.get("PAYMENT_RESERVATION_MINUTES", "20"))
ACCOUNT_DELETION_GRACE_DAYS = int(os.environ.get("ACCOUNT_DELETION_GRACE_DAYS", "30"))
ORDER_PII_RETENTION_DAYS = int(os.environ.get("ORDER_PII_RETENTION_DAYS", "2555"))
TAX_PRICES_INCLUDE_GST = os.environ.get("TAX_PRICES_INCLUDE_GST", "true").lower() == "true"
TAX_ORIGIN_STATE = os.environ.get("TAX_ORIGIN_STATE", "Maharashtra").strip()
BUSINESS_LEGAL_NAME = os.environ.get("BUSINESS_LEGAL_NAME", "Perfurm Commerce")
BUSINESS_GSTIN = os.environ.get("BUSINESS_GSTIN", "")
BUSINESS_ADDRESS = os.environ.get("BUSINESS_ADDRESS", "")
NOTIFICATION_DELIVERY_ENABLED = os.environ.get("NOTIFICATION_DELIVERY_ENABLED", "false").lower() == "true"
NOTIFICATION_MAX_ATTEMPTS = int(os.environ.get("NOTIFICATION_MAX_ATTEMPTS", "5"))
SMTP_HOST = os.environ.get("SMTP_HOST")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USE_TLS = os.environ.get("SMTP_USE_TLS", "true").lower() == "true"
SMTP_USE_SSL = os.environ.get("SMTP_USE_SSL", "false").lower() == "true"
SMTP_USERNAME = os.environ.get("SMTP_USERNAME")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.environ.get("SMTP_FROM_EMAIL")
SMS_WEBHOOK_URL = os.environ.get("SMS_WEBHOOK_URL")
SMS_WEBHOOK_TOKEN = os.environ.get("SMS_WEBHOOK_TOKEN")
SHIPPING_PROVIDER_API_URL = os.environ.get("SHIPPING_PROVIDER_API_URL")
SHIPPING_PROVIDER_API_TOKEN = os.environ.get("SHIPPING_PROVIDER_API_TOKEN")
SHIPPING_PROVIDER_WEBHOOK_SECRET = os.environ.get("SHIPPING_PROVIDER_WEBHOOK_SECRET")
METRICS_TOKEN = os.environ.get("METRICS_TOKEN")
REVERSE_GEOCODING_URL = os.environ.get("REVERSE_GEOCODING_URL", "https://api.bigdatacloud.net/data/reverse-geocode-client?latitude={latitude}&longitude={longitude}&localityLanguage=en")
request_metrics: Dict[str, Any] = {
    "started_at": time.time(), "requests_total": defaultdict(int),
    "duration_seconds_sum": 0.0, "duration_seconds_count": 0,
}
if APP_ENV in {"staging", "production"} and USE_MOCK_DB:
    raise RuntimeError("USE_MOCK_DB must be false outside development and test")

if USE_MOCK_DB:
    from mongomock_motor import AsyncMongoMockClient
    client = AsyncMongoMockClient()
else:
    client = AsyncIOMotorClient(mongo_url, tlsCAFile=certifi.where())

db = client[os.environ.get("DB_NAME", "ecommerce_db")]
# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY must be configured")
if APP_ENV in {"staging", "production"} and len(SECRET_KEY) < 32:
    raise RuntimeError("JWT_SECRET_KEY must contain at least 32 characters outside development")
ENABLE_DEMO_OTP = os.environ.get("ENABLE_DEMO_OTP", "false").lower() == "true"
if APP_ENV in {"staging", "production"} and ENABLE_DEMO_OTP:
    raise RuntimeError("ENABLE_DEMO_OTP must be false outside development and test")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", "30"))
REFRESH_COOKIE_NAME = os.environ.get("REFRESH_COOKIE_NAME", "perfurm_refresh")
CSRF_COOKIE_NAME = os.environ.get("CSRF_COOKIE_NAME", "perfurm_csrf")
COOKIE_DOMAIN = os.environ.get("COOKIE_DOMAIN") or None
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", str(APP_ENV in {"staging", "production"})).lower() == "true"
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "lax").lower()
CONSENT_POLICY_VERSION = os.environ.get("CONSENT_POLICY_VERSION", "2026-08-06.1")
COOKIE_POLICY_VERSION = os.environ.get("COOKIE_POLICY_VERSION", "2026-08-06.1")
PRIVACY_POLICY_VERSION = os.environ.get("PRIVACY_POLICY_VERSION", "2026-08-06.1")
CONSENT_EXPIRY_DAYS = int(os.environ.get("CONSENT_EXPIRY_DAYS", "180"))
GPC_SUPPORT = os.environ.get("GPC_SUPPORT", "true").lower() == "true"
if COOKIE_SAMESITE not in {"lax", "strict", "none"}:
    raise RuntimeError("COOKIE_SAMESITE must be lax, strict, or none")
if APP_ENV in {"staging", "production"} and not COOKIE_SECURE:
    raise RuntimeError("COOKIE_SECURE must be true outside development")
if not 1 <= CONSENT_EXPIRY_DAYS <= 365:
    raise RuntimeError("CONSENT_EXPIRY_DAYS must be between 1 and 365")

# Payment gateways (configure in .env)
razorpay_client = None
if os.environ.get('RAZORPAY_KEY_ID') and os.environ.get('RAZORPAY_KEY_SECRET'):
    razorpay_client = razorpay.Client(
        auth=(os.environ['RAZORPAY_KEY_ID'], os.environ['RAZORPAY_KEY_SECRET'])
    )

# Create the main app
app = FastAPI(
    title="Perfurm Commerce API",
    docs_url=None if APP_ENV == "production" else "/docs",
    redoc_url=None if APP_ENV == "production" else "/redoc",
)
api_router = APIRouter(prefix="/api")

# ============== ENUMS ==============
class UserRole(str, Enum):
    ADMIN = "admin"
    SELLER = "seller"
    CUSTOMER = "customer"
    DELIVERY_PARTNER = "delivery_partner"

class OrderStatus(str, Enum):
    PENDING = "pending"
    PAYMENT_PENDING = "payment_pending"
    PAYMENT_FAILED = "payment_failed"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    PACKED = "packed"
    READY_FOR_SHIPMENT = "ready_for_shipment"
    SHIPPED = "shipped"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    RETURN_REQUESTED = "return_requested"
    RETURN_APPROVED = "return_approved"
    RETURN_REJECTED = "return_rejected"
    PICKUP_SCHEDULED = "pickup_scheduled"
    RETURNED = "returned"
    REFUND_INITIATED = "refund_initiated"
    REFUNDED = "refunded"

class SellerStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"

# ============== MODELS ==============
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    password_hash: str
    role: UserRole
    name: str
    phone: Optional[str] = None
    profile_picture: Optional[str] = None
    bio: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True
    admin_role: Optional[str] = None
    permissions: List[str] = Field(default_factory=list)
    account_status: Literal["active", "disabled", "blocked"] = "active"
    restricted_until: Optional[datetime] = None
    promotional_credit: float = Field(default=0, ge=0)

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    name: str = Field(min_length=2, max_length=100, pattern=r"^[^<>]{2,100}$")
    phone: Optional[str] = Field(default=None, pattern=r"^[6-9]\d{9}$")
    role: UserRole = UserRole.CUSTOMER

class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

class ConsentPreferences(BaseModel):
    necessary: Literal[True] = True
    functional: bool = False
    analytics: bool = False
    marketing: bool = False
    personalization: bool = False

class ConsentRecordCreate(BaseModel):
    preferences: ConsentPreferences
    anonymous_id: Optional[str] = Field(default=None, min_length=16, max_length=100, pattern=r"^[A-Za-z0-9_-]+$")
    source: Literal["banner", "preference_center", "settings", "gpc"] = "banner"
    consent_policy_version: str = Field(min_length=1, max_length=50)
    cookie_policy_version: str = Field(min_length=1, max_length=50)
    privacy_policy_version: str = Field(min_length=1, max_length=50)

class ConsentPolicyUpdate(BaseModel):
    banner_title: str = Field(min_length=3, max_length=120)
    banner_description: str = Field(min_length=10, max_length=800)
    consent_expiry_days: int = Field(ge=1, le=365)
    gpc_support: bool = True
    enabled_categories: List[Literal["functional", "analytics", "marketing", "personalization"]]

ADMIN_ROLE_PERMISSIONS = {
    "super_admin": ["*"],
    "admin": ["sellers.manage", "customers.read", "privacy.manage", "orders.manage", "refunds.manage", "products.manage", "inventory.manage", "marketing.manage", "content.manage", "reviews.manage", "support.manage", "finance.manage", "analytics.read", "shipping.manage", "platform.manage"],
    "product_manager": ["products.manage"],
    "inventory_manager": ["inventory.manage", "products.read"],
    "order_manager": ["orders.manage", "shipping.manage"],
    "customer_support": ["customers.read", "orders.read", "support.manage", "reviews.manage"],
    "marketing_manager": ["marketing.manage", "analytics.read"],
    "content_manager": ["content.manage", "reviews.manage"],
    "finance_manager": ["finance.manage", "refunds.manage", "orders.read"],
    "read_only_analyst": ["analytics.read", "orders.read", "products.read", "customers.read"],
}

class AdminStaffCreate(BaseModel):
    email: EmailStr
    password: str
    name: str = Field(min_length=2, max_length=100)
    admin_role: str

class AdminStaffUpdate(BaseModel):
    admin_role: Optional[str] = None
    is_active: Optional[bool] = None

class AdminProductMerchandisingUpdate(BaseModel):
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    is_bestseller: Optional[bool] = None
    is_new_arrival: Optional[bool] = None
    is_limited_edition: Optional[bool] = None
    is_coming_soon: Optional[bool] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user: Dict[str, Any]

class Seller(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    business_name: str
    business_email: EmailStr
    business_phone: str
    gst_number: Optional[str] = None
    address: str
    city: str
    state: str
    pincode: str
    status: SellerStatus = SellerStatus.PENDING
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None

class SellerCreate(BaseModel):
    business_name: str
    business_email: EmailStr
    business_phone: str
    gst_number: Optional[str] = None
    address: str
    city: str
    state: str
    pincode: str

class ProductVariant(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku: str
    size_ml: Optional[float] = Field(default=None, gt=0)
    label: Optional[str] = None
    mrp: float = Field(gt=0)
    price: float = Field(gt=0)
    cost_price: Optional[float] = Field(default=None, ge=0)
    stock_quantity: int = Field(default=0, ge=0)
    low_stock_limit: int = Field(default=5, ge=0)
    image: Optional[str] = None
    is_active: bool = True

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    seller_id: str
    name: str
    brand: str = "Perfurm"
    slug: Optional[str] = None
    short_description: Optional[str] = None
    description: str
    category: str
    target_category: Optional[Literal["Men", "Women", "Unisex"]] = None
    fragrance_family: Optional[str] = None
    top_notes: List[str] = Field(default_factory=list)
    middle_notes: List[str] = Field(default_factory=list)
    base_notes: List[str] = Field(default_factory=list)
    concentration: Optional[str] = None
    price: float = Field(gt=0)
    mrp: float = Field(gt=0)
    cost_price: Optional[float] = Field(default=None, ge=0)
    sku: str
    images: List[str] = Field(default_factory=list)
    videos: List[str] = Field(default_factory=list)
    specifications: Dict[str, Any] = Field(default_factory=dict)
    filters: Dict[str, Any] = Field(default_factory=dict)
    colors: List[Dict[str, str]] = Field(default_factory=list)
    sizes: List[str] = Field(default_factory=list)
    variants: List[ProductVariant] = Field(default_factory=list)
    color_images: Dict[str, List[str]] = Field(default_factory=dict)
    longevity: Optional[str] = None
    sillage: Optional[str] = None
    seasons: List[str] = Field(default_factory=list)
    occasions: List[str] = Field(default_factory=list)
    ingredients: Optional[str] = None
    usage_instructions: Optional[str] = None
    safety_information: Optional[str] = None
    country_of_origin: Optional[str] = None
    manufacturer_details: Optional[str] = None
    shelf_life_months: Optional[int] = Field(default=None, gt=0)
    gst_category: Optional[str] = None
    is_featured: bool = False
    is_bestseller: bool = False
    is_new_arrival: bool = False
    is_limited_edition: bool = False
    is_coming_soon: bool = False
    average_rating: float = Field(default=0, ge=0, le=5)
    review_count: int = Field(default=0, ge=0)
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    seo_keywords: List[str] = Field(default_factory=list)
    canonical_url: Optional[str] = None
    is_active: bool = True
    view_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreate(BaseModel):
    name: str
    brand: str = "Perfurm"
    slug: Optional[str] = None
    short_description: Optional[str] = None
    description: str
    category: str
    target_category: Optional[Literal["Men", "Women", "Unisex"]] = None
    fragrance_family: Optional[str] = None
    top_notes: List[str] = Field(default_factory=list)
    middle_notes: List[str] = Field(default_factory=list)
    base_notes: List[str] = Field(default_factory=list)
    concentration: Optional[str] = None
    price: float = Field(gt=0)
    mrp: float = Field(gt=0)
    cost_price: Optional[float] = Field(default=None, ge=0)
    sku: str
    images: List[str] = []
    videos: List[str] = []
    specifications: Dict[str, Any] = {}
    filters: Dict[str, Any] = {}
    colors: List[Dict[str, str]] = []
    sizes: List[str] = []
    color_images: Dict[str, List[str]] = Field(default_factory=dict)
    variants: List[ProductVariant] = Field(default_factory=list)
    longevity: Optional[str] = None
    sillage: Optional[str] = None
    seasons: List[str] = Field(default_factory=list)
    occasions: List[str] = Field(default_factory=list)
    ingredients: Optional[str] = None
    usage_instructions: Optional[str] = None
    safety_information: Optional[str] = None
    country_of_origin: Optional[str] = None
    manufacturer_details: Optional[str] = None
    shelf_life_months: Optional[int] = Field(default=None, gt=0)
    gst_category: Optional[str] = None
    is_featured: bool = False
    is_bestseller: bool = False
    is_new_arrival: bool = False
    is_limited_edition: bool = False
    is_coming_soon: bool = False
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    seo_keywords: List[str] = Field(default_factory=list)
    canonical_url: Optional[str] = None

class Inventory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    seller_id: str
    quantity: int
    low_stock_threshold: int = 10
    last_restocked: Optional[datetime] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class VariantInventory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    variant_id: str
    seller_id: str
    sku: str
    stock_quantity: int = Field(default=0, ge=0)
    reserved_quantity: int = Field(default=0, ge=0)
    available_quantity: int = Field(default=0, ge=0)
    low_stock_threshold: int = Field(default=5, ge=0)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InventoryUpdate(BaseModel):
    quantity: int
    low_stock_threshold: Optional[int] = None

class VariantInventoryUpdate(BaseModel):
    stock_quantity: int = Field(ge=0)
    low_stock_threshold: Optional[int] = Field(default=None, ge=0)

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str
    items: List[Dict[str, Any]]  # [{product_id, seller_id, name, price, quantity}]
    total_amount: float
    subtotal: float = 0
    shipping_charge: float = 0
    discount_amount: float = 0
    taxable_amount: float = 0
    tax_percentage: float = 0
    tax_amount: float = 0
    tax_inclusive: bool = True
    cgst_amount: float = 0
    sgst_amount: float = 0
    igst_amount: float = 0
    invoice_eligible: bool = True
    coupon_code: Optional[str] = None
    coupon_id: Optional[str] = None
    status: OrderStatus = OrderStatus.PENDING
    payment_id: Optional[str] = None
    payment_status: str = "pending"
    payment_method: str = "cod"
    reservation_status: str = "finalized"
    idempotency_key: Optional[str] = None
    status_history: List[Dict[str, Any]] = Field(default_factory=list)
    shipping_address: Dict[str, str]
    # Delivery Partner Fields
    delivery_partner_id: Optional[str] = None
    delivery_partner_name: Optional[str] = None
    tracking_id: Optional[str] = None
    barcode: Optional[str] = None
    warehouse_id: Optional[str] = None
    # Platform Fee Fields
    platform_fee_percentage: float = 2.0
    platform_fee_amount: float = 0.0
    seller_payout: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrderCreate(BaseModel):
    items: List[Dict[str, Any]]
    total_amount: float
    subtotal: float = 0
    shipping_charge: float = 0
    shipping_address: Dict[str, str]
    payment_method: Literal["cod", "online"] = "cod"
    coupon_code: Optional[str] = Field(default=None, max_length=40)

class CheckoutQuoteRequest(BaseModel):
    items: List[Dict[str, Any]] = Field(min_length=1, max_length=100)
    pincode: str = Field(pattern=r"^[1-9]\d{5}$")
    state: str = Field(min_length=2, max_length=100)
    coupon_code: Optional[str] = Field(default=None, max_length=40)

class Review(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    customer_id: str
    customer_name: str
    order_id: str
    variant_id: Optional[str] = None
    order_item_key: str = ""
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=2000)
    images: List[str] = Field(default_factory=list, max_length=5)
    verified_purchase: bool = False
    moderation_status: Literal["pending", "approved", "rejected", "flagged"] = "pending"
    moderation_history: List[Dict[str, Any]] = Field(default_factory=list)
    admin_reply: Optional[str] = None
    helpful_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReviewCreate(BaseModel):
    product_id: str
    order_id: str
    variant_id: Optional[str] = None
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=2000)
    images: List[str] = Field(default_factory=list, max_length=5)

class ReviewModerationUpdate(BaseModel):
    status: Literal["approved", "rejected", "flagged"]
    reason: str = Field(min_length=3, max_length=500)
    admin_reply: Optional[str] = Field(default=None, max_length=1000)

class Coupon(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    discount_type: Literal["percentage", "fixed"]
    discount_value: float = Field(gt=0)
    min_order_amount: float = Field(default=0, ge=0)
    max_discount: Optional[float] = Field(default=None, gt=0)
    valid_from: datetime
    valid_until: datetime
    is_active: bool = True
    usage_limit: Optional[int] = None
    per_customer_usage_limit: Optional[int] = 1
    used_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    audience_type: Literal["all", "first_order", "completed_orders", "specific_users"] = "all"
    min_completed_orders: Optional[int] = None
    eligible_user_ids: List[str] = Field(default_factory=list)

class CouponCreate(BaseModel):
    code: str = Field(min_length=3, max_length=40, pattern=r"^[A-Za-z0-9_-]+$")
    discount_type: Literal["percentage", "fixed"]
    discount_value: float = Field(gt=0)
    min_order_amount: float = Field(default=0, ge=0)
    max_discount: Optional[float] = Field(default=None, gt=0)
    valid_from: datetime
    valid_until: datetime
    usage_limit: Optional[int] = Field(default=None, ge=1)
    per_customer_usage_limit: Optional[int] = Field(default=1, ge=1)
    audience_type: Literal["all", "first_order", "completed_orders", "specific_users"] = "all"
    min_completed_orders: Optional[int] = Field(default=None, ge=1, le=10000)
    eligible_user_ids: List[str] = Field(default_factory=list, max_length=10000)

    @model_validator(mode="after")
    def validate_coupon_rules(self):
        if self.valid_until <= self.valid_from:
            raise ValueError("Coupon expiry must be after its start date")
        if self.discount_type == "percentage" and self.discount_value > 100:
            raise ValueError("Percentage discount cannot exceed 100")
        if self.audience_type == "completed_orders" and not self.min_completed_orders:
            raise ValueError("Completed-order coupons require an order milestone")
        if self.audience_type == "specific_users" and not self.eligible_user_ids:
            raise ValueError("Select at least one eligible customer")
        return self

class CustomerAccountAction(BaseModel):
    status: Literal["active", "disabled", "blocked"]
    duration_days: Optional[int] = Field(default=None, ge=1, le=3650)
    reason: str = Field(min_length=3, max_length=500, pattern=r"^[^<>]{3,500}$")

class CustomerCreditGrant(BaseModel):
    amount: float = Field(gt=0, le=100000)
    product_id: Optional[str] = None
    reason: str = Field(min_length=3, max_length=300, pattern=r"^[^<>]{3,300}$")

class NotificationPreferences(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email_enabled: bool = True
    sms_enabled: bool = True
    push_enabled: bool = True
    marketing_enabled: bool = True
    order_updates: bool = True
    offers_promotions: bool = True

class Address(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    phone: str
    pincode: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    landmark: Optional[str] = None
    address_type: str = "home"  # home, work, other
    is_default: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AddressCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100, pattern=r"^[^<>]{2,100}$")
    phone: str = Field(pattern=r"^[6-9]\d{9}$")
    pincode: str = Field(pattern=r"^[1-9]\d{5}$")
    address_line1: str = Field(min_length=3, max_length=250, pattern=r"^[^<>]{3,250}$")
    address_line2: Optional[str] = Field(default=None, max_length=250, pattern=r"^[^<>]*$")
    city: str = Field(min_length=2, max_length=100, pattern=r"^[^<>]{2,100}$")
    state: str = Field(min_length=2, max_length=100, pattern=r"^[^<>]{2,100}$")
    landmark: Optional[str] = Field(default=None, max_length=150, pattern=r"^[^<>]*$")
    address_type: Literal["home", "work", "other"] = "home"
    is_default: bool = False

class ProductView(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    viewed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    theme: str = "light"
    language: str = "en"
    currency: str = "INR"
    notifications_email: bool = True
    notifications_sms: bool = True
    notifications_push: bool = True
    marketing_emails: bool = True
    order_updates: bool = True
    offers_promotions: bool = True
    wishlist_alerts: bool = True
    restock_alerts: bool = True
    price_drop_alerts: bool = True
    personalized_recommendations: bool = True
    analytics_consent: bool = True
    two_factor_enabled: bool = False
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TickerMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    message: str
    is_active: bool = True
    priority: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class NotificationCreate(BaseModel):
    title: str
    message: str
    type: str
    user_ids: Optional[List[str]] = None  # None means broadcast to all
    target_roles: Optional[List[str]] = None  # Filter by roles: customer, seller, admin, delivery_partner
    link_url: Optional[str] = None  # URL to navigate when notification is clicked

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    message: str
    type: str  # order_update, marketing, admin_broadcast, seller_approval, new_order, delivery_update
    link_url: Optional[str] = None  # URL to navigate when clicked
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SupportTicket(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    seller_id: Optional[str] = None
    subject: str
    message: str
    status: str = "open"  # open, in_progress, resolved
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TicketCreate(BaseModel):
    seller_id: Optional[str] = None
    subject: str
    message: str

# ============== DELIVERY PARTNER MODELS ==============
class DeliveryPartner(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # Links to user account
    company_name: str
    contact_person: str
    contact_number: str
    email: EmailStr
    service_areas: List[str] = []  # List of pincodes or cities
    vehicle_types: List[str] = []  # bike, van, truck
    is_active: bool = True
    rating: float = 0.0
    total_deliveries: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DeliveryPartnerCreate(BaseModel):
    company_name: str
    contact_person: str
    contact_number: str
    email: EmailStr
    service_areas: List[str] = []
    vehicle_types: List[str] = []

class DeliveryPartnerUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    contact_number: Optional[str] = None
    service_areas: Optional[List[str]] = None
    vehicle_types: Optional[List[str]] = None
    is_active: Optional[bool] = None

# ============== WAREHOUSE MODELS ==============
class Warehouse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    seller_id: str
    name: str
    contact_person: str
    contact_number: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    pincode: str
    landmark: Optional[str] = None
    is_default: bool = False
    pickup_timings: str = "10:00 AM - 6:00 PM"  # Default timing
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WarehouseCreate(BaseModel):
    name: str
    contact_person: str
    contact_number: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    pincode: str
    landmark: Optional[str] = None
    is_default: bool = False
    pickup_timings: str = "10:00 AM - 6:00 PM"

# ============== SHIPPING SETTINGS MODELS ==============
class ShippingSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    seller_id: str
    self_shipping: bool = False  # Seller handles own shipping
    marketplace_shipping: bool = True  # Use marketplace delivery partners
    return_address_same_as_warehouse: bool = True
    return_warehouse_id: Optional[str] = None
    cod_enabled: bool = True
    free_shipping_threshold: float = 500.0
    shipping_charge: float = 50.0
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ShippingSettingsUpdate(BaseModel):
    self_shipping: Optional[bool] = None
    marketplace_shipping: Optional[bool] = None
    return_address_same_as_warehouse: Optional[bool] = None
    return_warehouse_id: Optional[str] = None
    cod_enabled: Optional[bool] = None
    free_shipping_threshold: Optional[float] = None
    shipping_charge: Optional[float] = None

# ============== BUSINESS VERIFICATION MODELS ==============
class BusinessVerification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    seller_id: str
    gst_number: Optional[str] = None
    gst_verified: bool = False
    gst_document_url: Optional[str] = None
    pan_number: Optional[str] = None
    pan_verified: bool = False
    pan_document_url: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_verified: bool = False
    bank_document_url: Optional[str] = None
    aadhaar_number: Optional[str] = None
    aadhaar_verified: bool = False
    trade_license: Optional[str] = None
    verification_status: str = "pending"  # pending, in_progress, verified, rejected
    verified_at: Optional[datetime] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BusinessVerificationUpdate(BaseModel):
    gst_number: Optional[str] = None
    gst_document_url: Optional[str] = None
    pan_number: Optional[str] = None
    pan_document_url: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_document_url: Optional[str] = None
    aadhaar_number: Optional[str] = None
    trade_license: Optional[str] = None

# ============== SELLER PERFORMANCE MODELS ==============
class SellerPerformance(BaseModel):
    model_config = ConfigDict(extra="ignore")
    seller_id: str
    total_orders: int = 0
    completed_orders: int = 0
    cancelled_orders: int = 0
    fulfillment_rate: float = 0.0  # Percentage
    avg_response_time: float = 0.0  # In hours
    on_time_delivery_rate: float = 0.0  # Percentage
    rating: float = 0.0
    total_reviews: int = 0
    return_rate: float = 0.0
    customer_satisfaction: float = 0.0
    last_calculated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== PLATFORM FEE MODELS ==============
class PlatformFee(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    seller_id: str
    order_amount: float
    fee_percentage: float = 2.0  # 2% platform fee
    fee_amount: float
    seller_payout: float  # order_amount - fee_amount
    status: str = "pending"  # pending, paid, failed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    paid_at: Optional[datetime] = None

# ============== SHIPPING LABEL MODELS ==============
class ShippingLabel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    tracking_id: str
    barcode: str  # Same as tracking_id or generated separately
    delivery_partner_id: Optional[str] = None
    delivery_partner_name: Optional[str] = None
    warehouse_id: str
    weight: Optional[float] = None  # In kg
    dimensions: Optional[str] = None  # LxWxH in cm
    provider_reference: Optional[str] = None
    label_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ShippingLabelCreate(BaseModel):
    order_id: str
    delivery_partner_id: Optional[str] = None
    warehouse_id: str
    weight: Optional[float] = None
    dimensions: Optional[str] = None

# ============== DELIVERY STATUS MODELS ==============
class DeliveryStatus(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    tracking_id: str
    status: str  # picked_up, in_transit, out_for_delivery, delivered, failed
    location: Optional[str] = None
    remarks: Optional[str] = None
    updated_by: str  # delivery partner user_id
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DeliveryStatusUpdate(BaseModel):
    status: str
    location: Optional[str] = None
    remarks: Optional[str] = None

# ============== RETURN/CANCEL ORDER MODELS ==============
class ReturnPolicy(BaseModel):
    model_config = ConfigDict(extra="ignore")
    seller_id: str
    returns_enabled: bool = True
    return_window_days: int = Field(default=7, ge=0, le=30)
    replacement_enabled: bool = True
    replacement_window_days: int = Field(default=7, ge=0, le=30)
    conditions: Optional[str] = "Product must be unused and in original packaging"
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReturnRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    customer_id: str
    seller_id: str
    active_key: Optional[str] = None
    reason: str
    request_type: Literal["return", "replacement", "cancel"]
    status: str = "pending"
    images: List[str] = []
    admin_remarks: Optional[str] = None
    eligible_refund_amount: float = 0
    item_snapshot: List[Dict[str, Any]] = Field(default_factory=list)
    status_history: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReturnRequestCreate(BaseModel):
    order_id: str
    reason: str = Field(min_length=10, max_length=1000)
    request_type: Literal["return", "replacement", "cancel"]
    images: List[str] = Field(default_factory=list, max_length=5)

class ReturnRequestStatusUpdate(BaseModel):
    status: Literal["approved", "rejected", "pickup_scheduled", "received", "completed", "cancelled"]
    admin_remarks: Optional[str] = Field(default=None, max_length=1000)
    inventory_disposition: Optional[Literal["restock", "damaged"]] = None

# ============== TICKET SYSTEM MODELS ==============
class Ticket(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str
    customer_name: str
    subject: str
    description: str
    category: str  # order, product, payment, delivery, other
    status: str = "open"  # open, in_progress, resolved, closed
    priority: str = "medium"  # low, medium, high
    assigned_to: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TicketCreate(BaseModel):
    subject: str
    description: str
    category: str
    priority: str = "medium"

class TicketResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticket_id: str
    responder_id: str
    responder_name: str
    message: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== SELLER STORE MODELS ==============
class SellerStore(BaseModel):
    model_config = ConfigDict(extra="ignore")
    seller_id: str
    store_name: str
    store_description: Optional[str] = None
    store_images: List[str] = []
    store_address: Optional[str] = None
    store_city: Optional[str] = None
    store_state: Optional[str] = None
    store_pincode: Optional[str] = None
    store_phone: Optional[str] = None
    store_email: Optional[str] = None
    working_hours: Optional[str] = "10 AM - 8 PM"
    is_active: bool = True
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SellerStoreUpdate(BaseModel):
    store_name: Optional[str] = None
    store_description: Optional[str] = None
    store_images: Optional[List[str]] = None
    store_address: Optional[str] = None
    store_city: Optional[str] = None
    store_state: Optional[str] = None
    store_pincode: Optional[str] = None
    store_phone: Optional[str] = None
    store_email: Optional[str] = None
    working_hours: Optional[str] = None

# ============== FOOTER CONTENT MODELS ==============
class FooterContent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "footer_content"
    about_text: str = "Fine fragrance, thoughtfully discovered."
    facebook_url: Optional[str] = None
    instagram_url: Optional[str] = None
    twitter_url: Optional[str] = None
    youtube_url: Optional[str] = None
    contact_email: str = "care@perfurm.com"
    contact_phone: str = "+91 1234567890"
    address: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FooterContentUpdate(BaseModel):
    about_text: Optional[str] = None
    facebook_url: Optional[str] = None
    instagram_url: Optional[str] = None
    twitter_url: Optional[str] = None
    youtube_url: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None

# ============== OFFER CARDS MODELS ==============
class OfferCard(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    is_active: bool = True
    display_order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OfferCardCreate(BaseModel):
    title: str
    description: str
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    display_order: int = 0

class CreatorCampaign(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    creator_name: str
    media_url: str
    media_type: Literal["image", "video"] = "image"
    thumbnail_url: Optional[str] = None
    caption: Optional[str] = None
    destination_url: Optional[str] = None
    social_channel: Literal["instagram", "youtube", "facebook", "other"] = "instagram"
    campaign_code: Optional[str] = None
    is_active: bool = True
    display_order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CreatorCampaignCreate(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    creator_name: str = Field(min_length=2, max_length=100)
    media_url: str
    media_type: Literal["image", "video"] = "image"
    thumbnail_url: Optional[str] = None
    caption: Optional[str] = Field(default=None, max_length=500)
    destination_url: Optional[str] = None
    social_channel: Literal["instagram", "youtube", "facebook", "other"] = "instagram"
    campaign_code: Optional[str] = Field(default=None, max_length=40)
    display_order: int = 0

class CampaignEventCreate(BaseModel):
    visitor_id: str = Field(min_length=8, max_length=100)
    event_type: Literal["view", "click", "like"]
    source: Optional[str] = Field(default=None, max_length=80)
    referrer: Optional[str] = Field(default=None, max_length=500)

# ============== BANK OFFERS MODELS ==============
class BankOffer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bank_name: str
    offer_text: str
    discount_percentage: Optional[float] = None
    max_discount: Optional[float] = None
    min_order_amount: float = 0
    card_type: Optional[str] = None  # credit, debit, all
    is_active: bool = True
    valid_until: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BankOfferCreate(BaseModel):
    bank_name: str
    offer_text: str
    discount_percentage: Optional[float] = None
    max_discount: Optional[float] = None
    min_order_amount: float = 0
    card_type: Optional[str] = None
    valid_until: datetime

# ============== PRODUCT FILTERS MODELS ==============
class ProductFilter(BaseModel):
    model_config = ConfigDict(extra="ignore")
    category: str
    filter_name: str
    filter_options: List[str]

# ============== PLATFORM SETTINGS MODELS ==============
class PlatformSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "platform_settings"
    platform_fee_percentage: float = 2.0
    promotion_fee_percentage: float = 1.0
    gst_percentage: float = 18.0
    payment_cycle_days: int = 7  # Weekly payment to sellers
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PlatformSettingsUpdate(BaseModel):
    platform_fee_percentage: Optional[float] = Field(default=None, ge=0, le=100)
    promotion_fee_percentage: Optional[float] = Field(default=None, ge=0, le=100)
    gst_percentage: Optional[float] = Field(default=None, ge=0, le=100)
    payment_cycle_days: Optional[int] = Field(default=None, ge=1, le=365)

# ============== SELLER PAYOUT MODELS ==============
class SellerPayout(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    seller_id: str
    period_start: datetime
    period_end: datetime
    total_orders: int
    gross_amount: float
    platform_fee: float
    promotion_fee: float
    net_payout: float
    status: str = "pending"  # pending, processed, paid
    processed_at: Optional[datetime] = None
    payment_reference: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== NOTIFICATION READ STATUS ==============
class NotificationUpdate(BaseModel):
    is_read: bool = True

# ============== STOREFRONT VISIBILITY SETTINGS ==============
class StorefrontVisibility(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "storefront_visibility"
    show_hero_banner: bool = True
    show_ticker: bool = True
    show_categories: bool = True
    show_most_viewed: bool = True
    show_trending: bool = True
    show_bestsellers: bool = True
    show_new_arrivals: bool = True
    show_offer_cards: bool = True
    show_bank_offers: bool = True
    show_view_store: bool = True
    show_footer: bool = True
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StorefrontVisibilityUpdate(BaseModel):
    show_hero_banner: Optional[bool] = None
    show_ticker: Optional[bool] = None
    show_categories: Optional[bool] = None
    show_most_viewed: Optional[bool] = None
    show_trending: Optional[bool] = None
    show_bestsellers: Optional[bool] = None
    show_new_arrivals: Optional[bool] = None
    show_offer_cards: Optional[bool] = None
    show_bank_offers: Optional[bool] = None
    show_view_store: Optional[bool] = None
    show_footer: Optional[bool] = None

# ============== HERO BANNER MODELS ==============
class HeroBanner(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    subtitle: Optional[str] = None
    image_url: str
    button_text: str = "Shop Now"
    button_link: Optional[str] = None
    is_active: bool = True
    display_order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class HeroBannerCreate(BaseModel):
    title: str
    subtitle: Optional[str] = None
    image_url: str
    button_text: str = "Shop Now"
    button_link: Optional[str] = None
    display_order: int = 0

class HeroBannerUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    image_url: Optional[str] = None
    button_text: Optional[str] = None
    button_link: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None

# ============== SUPPORT SETTINGS MODELS ==============
class SupportSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "support_settings"
    support_email: str = "care@perfurm.com"
    support_phone: str = "+91 1234567890"
    whatsapp_number: Optional[str] = None
    working_hours: str = "Mon-Sat: 10 AM - 6 PM"
    support_address: Optional[str] = None
    faq_enabled: bool = True
    live_chat_enabled: bool = False
    ticket_system_enabled: bool = True
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SupportSettingsUpdate(BaseModel):
    support_email: Optional[str] = None
    support_phone: Optional[str] = None
    whatsapp_number: Optional[str] = None
    working_hours: Optional[str] = None
    support_address: Optional[str] = None
    faq_enabled: Optional[bool] = None
    live_chat_enabled: Optional[bool] = None
    ticket_system_enabled: Optional[bool] = None

# ============== AUTH HELPERS ==============
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def validate_password_strength(password: str) -> None:
    if len(password) < 10 or not re.search(r"[A-Z]", password) or not re.search(r"[a-z]", password) or not re.search(r"\d", password) or not re.search(r"[^A-Za-z0-9]", password):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 10 characters and include uppercase, lowercase, number and symbol",
        )

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

async def create_refresh_session(user_id: str, request: Request, response: Response) -> str:
    raw_token = secrets.token_urlsafe(48)
    now = datetime.now(timezone.utc)
    session = {
        "id": str(uuid.uuid4()), "user_id": user_id,
        "token_hash": token_digest(raw_token), "created_at": now,
        "last_used_at": now, "expires_at": now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "revoked_at": None,
        "user_agent": request.headers.get("User-Agent", "")[:300],
        "ip_address": request.client.host if request.client else None,
    }
    await db.auth_sessions.insert_one(session)
    response.set_cookie(
        key=REFRESH_COOKIE_NAME, value=raw_token,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        httponly=True, secure=COOKIE_SECURE, domain=COOKIE_DOMAIN,
        samesite=COOKIE_SAMESITE, path="/api/auth",
    )
    csrf_token = secrets.token_urlsafe(32)
    response.set_cookie(
        key=CSRF_COOKIE_NAME, value=csrf_token, max_age=REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        httponly=False, secure=COOKIE_SECURE, domain=COOKIE_DOMAIN,
        samesite=COOKIE_SAMESITE, path="/",
    )
    return session["id"]

def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        REFRESH_COOKIE_NAME, path="/api/auth",
        httponly=True, secure=COOKIE_SECURE, domain=COOKIE_DOMAIN, samesite=COOKIE_SAMESITE,
    )
    response.delete_cookie(CSRF_COOKIE_NAME, path="/", secure=COOKIE_SECURE, domain=COOKIE_DOMAIN, samesite=COOKIE_SAMESITE)

def require_cookie_csrf(request: Request) -> None:
    """Double-submit protection for endpoints authenticated by the refresh cookie."""
    csrf_cookie = request.cookies.get(CSRF_COOKIE_NAME, "")
    csrf_header = request.headers.get("X-CSRF-Token", "")
    if not csrf_cookie or not csrf_header or not secrets.compare_digest(csrf_cookie, csrf_header):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    origin = request.headers.get("Origin")
    allowed = {item.strip().rstrip("/") for item in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",") if item.strip()}
    if origin and origin.rstrip("/") not in allowed and not (APP_ENV == "development" and origin.endswith(".trycloudflare.com")):
        raise HTTPException(status_code=403, detail="Request origin is not allowed")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        user = await db.users.find_one({"id": user_id, "is_active": True}, {"_id": 0, "password_hash": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

def require_role(allowed_roles: List[UserRole]):
    async def role_checker(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        if user["role"] not in [r.value for r in allowed_roles]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker

def require_super_admin(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if user.get("role") != UserRole.ADMIN.value or user.get("admin_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super administrator permission required")
    return user

def required_admin_permission(path: str) -> str:
    mappings = [
        ("/api/analytics/admin", "analytics.read"),
        ("/api/admin/staff", "permissions.manage"),
        ("/api/admin/analytics", "analytics.read"),
        ("/api/admin/seller-performance", "analytics.read"),
        ("/api/admin/sellers", "sellers.manage"),
        ("/api/admin/business-verification", "sellers.manage"),
        ("/api/admin/privacy", "privacy.manage"),
        ("/api/admin/users", "customers.read"),
        ("/api/admin/customers", "customers.read"),
        ("/api/admin/orders", "orders.manage"),
        ("/api/admin/return-requests", "orders.manage"),
        ("/api/admin/reviews", "reviews.manage"),
        ("/api/admin/catalogue", "products.manage"),
        ("/api/admin/inventory", "inventory.manage"),
        ("/api/admin/products", "products.manage"),
        ("/api/admin/tickets", "support.manage"),
        ("/api/admin/coupons", "marketing.manage"),
        ("/api/admin/notifications", "marketing.manage"),
        ("/api/admin/offer-cards", "marketing.manage"),
        ("/api/admin/creator-campaigns", "marketing.manage"),
        ("/api/admin/bank-offers", "marketing.manage"),
        ("/api/admin/ticker", "marketing.manage"),
        ("/api/admin/hero-banners", "content.manage"),
        ("/api/admin/footer-content", "content.manage"),
        ("/api/admin/storefront-visibility", "content.manage"),
        ("/api/admin/support-settings", "content.manage"),
        ("/api/admin/seller-payouts", "finance.manage"),
        ("/api/admin/generate-payouts", "finance.manage"),
        ("/api/admin/platform-fees", "finance.manage"),
        ("/api/admin/pincode-rules", "shipping.manage"),
        ("/api/admin/platform-settings", "platform.manage"),
    ]
    if "/refund" in path:
        return "refunds.manage"
    return next((permission for prefix, permission in mappings if path.startswith(prefix)), "admin.manage")

# ============== HELPER FUNCTIONS ==============
def generate_tracking_id() -> str:
    """Generate unique tracking ID like Flipkart (e.g., FMP123456789)"""
    import random
    import string
    prefix = "PFM"  # Perfurm
    numbers = ''.join(random.choices(string.digits, k=12))
    return f"{prefix}{numbers}"

def generate_barcode(tracking_id: str) -> str:
    """Generate barcode (same as tracking ID for simplicity)"""
    return tracking_id

def calculate_platform_fee(order_amount: float, fee_percentage: float = 2.0) -> Dict[str, float]:
    """Calculate platform fee and seller payout"""
    fee_amount = round((order_amount * fee_percentage) / 100, 2)
    seller_payout = round(order_amount - fee_amount, 2)
    return {
        "fee_amount": fee_amount,
        "seller_payout": seller_payout,
        "fee_percentage": fee_percentage
    }

async def update_seller_performance(seller_id: str):
    """Recalculate seller performance metrics"""
    # Get all orders for this seller
    orders = await db.orders.find({"items.seller_id": seller_id}).to_list(1000)
    
    total_orders = len(orders)
    completed = len([o for o in orders if o.get("status") == "delivered"])
    cancelled = len([o for o in orders if o.get("status") == "cancelled"])
    
    fulfillment_rate = (completed / total_orders * 100) if total_orders > 0 else 0.0
    
    # Get reviews for seller's products
    seller_products = await db.products.find({"seller_id": seller_id}).to_list(1000)
    product_ids = [p["id"] for p in seller_products]
    reviews = await db.reviews.find({"product_id": {"$in": product_ids}}).to_list(1000)
    
    avg_rating = sum([r["rating"] for r in reviews]) / len(reviews) if reviews else 0.0
    
    # Update or create performance record
    performance = {
        "seller_id": seller_id,
        "total_orders": total_orders,
        "completed_orders": completed,
        "cancelled_orders": cancelled,
        "fulfillment_rate": round(fulfillment_rate, 2),
        "rating": round(avg_rating, 2),
        "total_reviews": len(reviews),
        "last_calculated": datetime.now(timezone.utc)
    }
    
    await db.seller_performance.update_one(
        {"seller_id": seller_id},
        {"$set": performance},
        upsert=True
    )

# ============== AUTH ROUTES ==============
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate, request: Request, response: Response):
    if user_data.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=403, detail="Public registration creates Customer accounts only")
    validate_password_strength(user_data.password)
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        name=user_data.name,
        phone=user_data.phone,
        role=user_data.role
    )
    
    await db.users.insert_one(user.model_dump())
    
    # Create token
    token = create_access_token({"sub": user.id, "role": user.role.value})
    await create_refresh_session(user.id, request, response)
    user_dict = user.model_dump()
    del user_dict["password_hash"]
    
    # Send notification to all admins about new user registration
    admins = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(100)
    for admin in admins:
        admin_notification = Notification(
            user_id=admin["id"],
            title="New User Registration",
            message=f"New {user_data.role} registered: {user_data.name} ({user_data.email})",
            type="admin_broadcast",
            link_url="/admin/users" if user_data.role == "customer" else "/admin/sellers"
        )
        await db.notifications.insert_one(admin_notification.model_dump())
    
    # If seller, notify admins about pending approval
    if user_data.role == UserRole.SELLER.value:
        for admin in admins:
            seller_notification = Notification(
                user_id=admin["id"],
                title="New Seller Registration - Approval Required",
                message=f"Seller {user_data.name} ({user_data.email}) requires approval",
                type="seller_approval",
                link_url="/admin/sellers/approvals"
            )
            await db.notifications.insert_one(seller_notification.model_dump())
    
    return Token(access_token=token, token_type="bearer", user=user_dict)

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin, request: Request, response: Response):
    client_ip = request.client.host if request.client else "unknown"
    ip_limit_key = f"login-ip:{privacy_key(client_ip)}"
    identity_limit_key = f"login-user:{privacy_key(str(credentials.email))}"
    await enforce_rate_limit(ip_limit_key, 20, 900)
    await enforce_rate_limit(identity_limit_key, 5, 900)
    user = await db.users.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    restricted_until = user.get("restricted_until")
    if not user.get("is_active", True) and restricted_until and _coupon_datetime(restricted_until) <= datetime.now(timezone.utc):
        await db.users.update_one({"id": user["id"]}, {"$set": {"is_active": True, "account_status": "active", "restricted_until": None}})
        user.update({"is_active": True, "account_status": "active", "restricted_until": None})
    if not user.get("is_active", True):
        label = user.get("account_status", "disabled")
        until_text = f" until {_coupon_datetime(restricted_until).date()}" if restricted_until else " until an administrator reactivates it"
        inactive_status = 403 if user.get("role") == UserRole.CUSTOMER.value else 401
        raise HTTPException(status_code=inactive_status, detail=f"Account is {label}{until_text}. Contact support if you need help.")
    
    token = create_access_token({"sub": user["id"], "role": user["role"]})
    await create_refresh_session(user["id"], request, response)
    # Successful authentication ends the failed-attempt window; normal session switching
    # must not lock legitimate users out while repeated failures remain throttled.
    await db.rate_limits.delete_many({"key": {"$in": [ip_limit_key, identity_limit_key]}})
    del user["password_hash"]
    del user["_id"]
    
    return Token(access_token=token, token_type="bearer", user=user)

@api_router.get("/auth/me")
async def get_me(user: Dict[str, Any] = Depends(get_current_user)):
    return user

@api_router.post("/auth/refresh", response_model=Token)
async def refresh_session(request: Request, response: Response):
    raw_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not raw_token:
        raise HTTPException(status_code=401, detail="Refresh session is missing")
    require_cookie_csrf(request)
    now = datetime.now(timezone.utc)
    session = await db.auth_sessions.find_one({
        "token_hash": token_digest(raw_token), "revoked_at": None,
        "expires_at": {"$gt": now},
    })
    if not session:
        clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Refresh session is invalid or expired")
    user = await db.users.find_one(
        {"id": session["user_id"], "is_active": True}, {"_id": 0, "password_hash": 0}
    )
    if not user:
        await db.auth_sessions.update_one({"id": session["id"]}, {"$set": {"revoked_at": now}})
        clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Account is unavailable")

    # Rotate on every use so a stolen refresh token cannot be replayed indefinitely.
    await db.auth_sessions.update_one(
        {"id": session["id"], "revoked_at": None},
        {"$set": {"revoked_at": now, "replaced_at": now}},
    )
    await create_refresh_session(user["id"], request, response)
    access_token = create_access_token({"sub": user["id"], "role": user["role"]})
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.post("/auth/logout")
async def logout_session(request: Request, response: Response):
    if request.cookies.get(REFRESH_COOKIE_NAME):
        require_cookie_csrf(request)
    raw_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if raw_token:
        await db.auth_sessions.update_one(
            {"token_hash": token_digest(raw_token), "revoked_at": None},
            {"$set": {"revoked_at": datetime.now(timezone.utc)}},
        )
    clear_refresh_cookie(response)
    return {"message": "Logged out"}

@api_router.get("/auth/sessions")
async def list_sessions(user: Dict[str, Any] = Depends(get_current_user)):
    sessions = await db.auth_sessions.find(
        {"user_id": user["id"], "revoked_at": None, "expires_at": {"$gt": datetime.now(timezone.utc)}},
        {"_id": 0, "token_hash": 0},
    ).sort("created_at", -1).to_list(100)
    return sessions

@api_router.delete("/auth/sessions/{session_id}")
async def revoke_session(session_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    result = await db.auth_sessions.update_one(
        {"id": session_id, "user_id": user["id"], "revoked_at": None},
        {"$set": {"revoked_at": datetime.now(timezone.utc)}},
    )
    if result.modified_count != 1:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"message": "Session revoked"}

@api_router.get("/admin/staff")
async def list_admin_staff(user: Dict[str, Any] = Depends(require_super_admin)):
    return await db.users.find(
        {"role": UserRole.ADMIN.value}, {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).to_list(1000)

@api_router.post("/admin/staff")
async def create_admin_staff(payload: AdminStaffCreate, user: Dict[str, Any] = Depends(require_super_admin)):
    if payload.admin_role not in ADMIN_ROLE_PERMISSIONS or payload.admin_role == "super_admin":
        raise HTTPException(status_code=400, detail="Invalid delegated admin role")
    validate_password_strength(payload.password)
    if await db.users.find_one({"email": payload.email}):
        raise HTTPException(status_code=409, detail="Email already registered")
    staff = User(
        email=payload.email, password_hash=hash_password(payload.password), role=UserRole.ADMIN,
        name=payload.name, admin_role=payload.admin_role,
        permissions=ADMIN_ROLE_PERMISSIONS[payload.admin_role],
    )
    await db.users.insert_one(staff.model_dump())
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()), "actor_id": user["id"], "action": "admin_staff_created",
        "resource_type": "user", "resource_id": staff.id, "changes": {"admin_role": payload.admin_role},
        "at": datetime.now(timezone.utc),
    })
    result = staff.model_dump(exclude={"password_hash"})
    return result

@api_router.put("/admin/staff/{staff_id}")
async def update_admin_staff(
    staff_id: str, payload: AdminStaffUpdate,
    user: Dict[str, Any] = Depends(require_super_admin),
):
    staff = await db.users.find_one({"id": staff_id, "role": UserRole.ADMIN.value})
    if not staff:
        raise HTTPException(status_code=404, detail="Admin staff member not found")
    if staff.get("admin_role") == "super_admin":
        raise HTTPException(status_code=403, detail="The super administrator cannot be modified here")
    updates: Dict[str, Any] = {}
    if payload.admin_role is not None:
        if payload.admin_role not in ADMIN_ROLE_PERMISSIONS or payload.admin_role == "super_admin":
            raise HTTPException(status_code=400, detail="Invalid delegated admin role")
        updates.update({"admin_role": payload.admin_role, "permissions": ADMIN_ROLE_PERMISSIONS[payload.admin_role]})
    if payload.is_active is not None:
        updates["is_active"] = payload.is_active
    if not updates:
        raise HTTPException(status_code=400, detail="No changes supplied")
    await db.users.update_one({"id": staff_id}, {"$set": updates})
    if payload.is_active is False:
        await db.auth_sessions.update_many(
            {"user_id": staff_id, "revoked_at": None},
            {"$set": {"revoked_at": datetime.now(timezone.utc), "reason": "admin_disabled"}},
        )
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()), "actor_id": user["id"], "action": "admin_staff_updated",
        "resource_type": "user", "resource_id": staff_id, "changes": updates,
        "at": datetime.now(timezone.utc),
    })
    return await db.users.find_one({"id": staff_id}, {"_id": 0, "password_hash": 0})


@api_router.delete("/admin/staff/{staff_id}")
async def remove_admin_staff(staff_id: str, user: Dict[str, Any] = Depends(require_super_admin)):
    if staff_id == user["id"]:
        raise HTTPException(status_code=409, detail="You cannot remove your own account")
    staff = await db.users.find_one({"id": staff_id, "role": UserRole.ADMIN.value}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Admin staff member not found")
    if staff.get("admin_role") == "super_admin":
        raise HTTPException(status_code=403, detail="Super administrator accounts are protected")
    now = datetime.now(timezone.utc)
    await db.users.update_one({"id": staff_id}, {"$set": {"is_active": False, "removed_at": now, "removed_by": user["id"]}})
    await db.auth_sessions.update_many({"user_id": staff_id, "revoked_at": None}, {"$set": {"revoked_at": now, "reason": "admin_removed"}})
    await db.audit_logs.insert_one({"id": str(uuid.uuid4()), "actor_id": user["id"], "action": "admin_staff_removed", "resource_type": "user", "resource_id": staff_id, "at": now})
    return {"message": "Administrator removed"}

# ============== OTP AUTHENTICATION ==============
import random
import string

def generate_otp():
    return ''.join(random.choices(string.digits, k=6))

def otp_digest(value: str) -> str:
    return hmac.new(SECRET_KEY.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).hexdigest()

def privacy_key(value: str) -> str:
    return hmac.new(SECRET_KEY.encode("utf-8"), value.lower().encode("utf-8"), hashlib.sha256).hexdigest()

async def enforce_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    now = datetime.now(timezone.utc)
    window = int(now.timestamp()) // window_seconds
    document = await db.rate_limits.find_one_and_update(
        {"key": key, "window": window},
        {
            "$inc": {"count": 1},
            "$setOnInsert": {"expires_at": now + timedelta(seconds=window_seconds * 2)},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    if document["count"] > limit:
        retry_after = window_seconds - (int(now.timestamp()) % window_seconds)
        raise HTTPException(
            status_code=429, detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )

async def save_auth_challenge(key: str, otp: str) -> None:
    await db.auth_challenges.update_one(
        {"key": key},
        {"$set": {
            "otp_hash": otp_digest(otp), "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
            "attempts": 0, "verified": False, "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )

class OtpRequest(BaseModel):
    phone: str
    method: str = "sms"  # sms or whatsapp

class OtpVerifyLogin(BaseModel):
    phone: str
    otp: str

class ForgotPasswordRequest(BaseModel):
    email: str

class VerifyResetOtp(BaseModel):
    email: str
    otp: str

class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str

@api_router.post("/auth/send-otp")
async def send_otp(payload: OtpRequest, http_request: Request):
    """Send OTP for phone login"""
    phone = payload.phone
    if not phone or len(phone) != 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    client_ip = http_request.client.host if http_request.client else "unknown"
    await enforce_rate_limit(f"otp-send-ip:{privacy_key(client_ip)}", 20, 3600)
    await enforce_rate_limit(f"otp-send-phone:{privacy_key(phone)}", 5, 3600)
    
    # Check if user exists with this phone
    user = await db.users.find_one({"phone": phone})
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this phone number")
    
    otp = generate_otp()
    await save_auth_challenge(f"login:{privacy_key(phone)}", otp)
    
    response = {"message": f"OTP sent via {payload.method}"}
    if ENABLE_DEMO_OTP:
        response["demo_otp"] = otp
    return response

@api_router.post("/auth/verify-otp-login", response_model=Token)
async def verify_otp_login(payload: OtpVerifyLogin, http_request: Request, response: Response):
    """Verify OTP and login"""
    phone = payload.phone
    otp_key = f"login:{privacy_key(phone)}"
    await enforce_rate_limit(f"otp-verify:{privacy_key(phone)}", 10, 900)
    stored = await db.auth_challenges.find_one({"key": otp_key})
    if not stored:
        raise HTTPException(status_code=400, detail="OTP expired or not sent")
    
    if stored["attempts"] >= 3:
        await db.auth_challenges.delete_one({"key": otp_key})
        raise HTTPException(status_code=429, detail="Too many attempts. Please request new OTP")
    
    if datetime.now(timezone.utc) > stored["expires_at"]:
        await db.auth_challenges.delete_one({"key": otp_key})
        raise HTTPException(status_code=400, detail="OTP expired")
    
    if not hmac.compare_digest(stored["otp_hash"], otp_digest(payload.otp)):
        await db.auth_challenges.update_one({"key": otp_key}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # OTP verified - login user
    await db.auth_challenges.delete_one({"key": otp_key})
    
    user = await db.users.find_one({"phone": phone})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    token = create_access_token({"sub": user["id"], "role": user["role"]})
    await create_refresh_session(user["id"], http_request, response)
    del user["password_hash"]
    del user["_id"]
    
    return Token(access_token=token, token_type="bearer", user=user)

@api_router.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, http_request: Request):
    """Send OTP for password reset"""
    client_ip = http_request.client.host if http_request.client else "unknown"
    await enforce_rate_limit(f"reset-ip:{privacy_key(client_ip)}", 20, 3600)
    await enforce_rate_limit(f"reset-user:{privacy_key(payload.email)}", 5, 3600)
    user = await db.users.find_one({"email": payload.email})
    if not user:
        return {"message": "If an account exists, a reset code has been sent"}
    
    otp = generate_otp()
    await save_auth_challenge(f"reset:{privacy_key(payload.email)}", otp)
    
    response = {"message": "OTP sent to your email"}
    if ENABLE_DEMO_OTP:
        response["demo_otp"] = otp
    return response

@api_router.post("/auth/verify-reset-otp")
async def verify_reset_otp(request: VerifyResetOtp):
    """Verify OTP for password reset"""
    otp_key = f"reset:{privacy_key(request.email)}"
    await enforce_rate_limit(f"reset-verify:{privacy_key(request.email)}", 10, 900)
    stored = await db.auth_challenges.find_one({"key": otp_key})
    if not stored:
        raise HTTPException(status_code=400, detail="OTP expired or not sent")
    
    if stored["attempts"] >= 3:
        await db.auth_challenges.delete_one({"key": otp_key})
        raise HTTPException(status_code=429, detail="Too many attempts. Please request new OTP")
    
    if datetime.now(timezone.utc) > stored["expires_at"]:
        await db.auth_challenges.delete_one({"key": otp_key})
        raise HTTPException(status_code=400, detail="OTP expired")
    
    if not hmac.compare_digest(stored["otp_hash"], otp_digest(request.otp)):
        await db.auth_challenges.update_one({"key": otp_key}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Mark OTP as verified
    await db.auth_challenges.update_one({"key": otp_key}, {"$set": {"verified": True}})
    
    return {"message": "OTP verified successfully"}

@api_router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password after OTP verification"""
    otp_key = f"reset:{privacy_key(request.email)}"
    stored = await db.auth_challenges.find_one({"key": otp_key})
    if not stored:
        raise HTTPException(status_code=400, detail="Please verify OTP first")
    
    if not stored.get("verified"):
        raise HTTPException(status_code=400, detail="Please verify OTP first")
    
    if not hmac.compare_digest(stored["otp_hash"], otp_digest(request.otp)):
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    validate_password_strength(request.new_password)
    # Update password
    new_hash = hash_password(request.new_password)
    await db.users.update_one(
        {"email": request.email},
        {"$set": {"password_hash": new_hash}}
    )
    user = await db.users.find_one({"email": request.email}, {"_id": 0, "id": 1})
    if user:
        await db.auth_sessions.update_many(
            {"user_id": user["id"], "revoked_at": None},
            {"$set": {"revoked_at": datetime.now(timezone.utc), "reason": "password_reset"}},
        )
    
    await db.auth_challenges.delete_one({"key": otp_key})
    
    return {"message": "Password reset successfully"}

# ============== SELLER ROUTES ==============
@api_router.post("/sellers/register", response_model=Seller)
async def register_seller(
    seller_data: SellerCreate,
    user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))
):
    # Check if seller already exists
    existing = await db.sellers.find_one({"user_id": user["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Seller profile already exists")
    
    seller = Seller(
        user_id=user["id"],
        **seller_data.model_dump()
    )
    
    await db.sellers.insert_one(seller.model_dump())
    return seller

@api_router.get("/sellers/me", response_model=Seller)
async def get_my_seller_profile(user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))):
    seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    return seller

@api_router.get("/admin/sellers", response_model=List[Seller])
async def get_all_sellers(user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))):
    sellers = await db.sellers.find({}, {"_id": 0}).to_list(1000)
    return sellers

@api_router.put("/admin/sellers/{seller_id}/approve")
async def approve_seller(
    seller_id: str,
    approve: bool,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    seller = await db.sellers.find_one({"id": seller_id})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    
    new_status = SellerStatus.APPROVED if approve else SellerStatus.REJECTED
    await db.sellers.update_one(
        {"id": seller_id},
        {
            "$set": {
                "status": new_status.value,
                "approved_at": datetime.now(timezone.utc).isoformat(),
                "approved_by": user["id"]
            }
        }
    )
    
    # Send notification
    notification = Notification(
        user_id=seller["user_id"],
        title="Seller Application Update",
        message=f"Your seller application has been {new_status.value}",
        type="admin_broadcast"
    )
    await db.notifications.insert_one(notification.model_dump())
    
    return {"message": f"Seller {new_status.value}"}

# ============== PRODUCT ROUTES ==============
def normalized_product_slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:120]


async def validate_product_catalogue_payload(payload: ProductCreate, product_id: Optional[str] = None) -> str:
    if payload.price > payload.mrp:
        raise HTTPException(status_code=422, detail="Selling price cannot exceed MRP")
    slug = normalized_product_slug(payload.slug or payload.name)
    if not slug:
        raise HTTPException(status_code=422, detail="Product name must produce a valid URL slug")
    duplicate = await db.products.find_one({
        "$or": [{"sku": payload.sku}, {"slug": slug}],
        **({"id": {"$ne": product_id}} if product_id else {}),
    })
    if duplicate:
        field = "SKU" if duplicate.get("sku") == payload.sku else "slug"
        raise HTTPException(status_code=409, detail=f"Product {field} is already in use")
    variant_skus = [variant.sku.strip() for variant in payload.variants]
    if len(variant_skus) != len(set(variant_skus)):
        raise HTTPException(status_code=422, detail="Variant SKUs must be unique within a product")
    if payload.sku in variant_skus:
        raise HTTPException(status_code=422, detail="Product SKU and variant SKUs must be different")
    for variant in payload.variants:
        if variant.price > variant.mrp:
            raise HTTPException(status_code=422, detail=f"Variant {variant.sku} price cannot exceed MRP")
        existing = await db.variant_inventory.find_one({
            "sku": variant.sku,
            **({"product_id": {"$ne": product_id}} if product_id else {}),
        })
        if existing:
            raise HTTPException(status_code=409, detail=f"Variant SKU {variant.sku} is already in use")
    return slug


@api_router.post("/products", response_model=Product)
async def create_product(
    product_data: ProductCreate,
    user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))
):
    # Check if seller is approved
    seller = await db.sellers.find_one({"user_id": user["id"]})
    if not seller or seller["status"] != SellerStatus.APPROVED.value:
        raise HTTPException(status_code=403, detail="Seller not approved")
    slug = await validate_product_catalogue_payload(product_data)
    product = Product(
        seller_id=seller["id"],
        **{
            **product_data.model_dump(), "slug": slug,
            "is_featured": False, "is_bestseller": False,
            "is_new_arrival": False, "is_limited_edition": False,
        }
    )
    
    await db.products.insert_one(product.model_dump())
    
    # Initialize inventory
    inventory = Inventory(
        product_id=product.id,
        seller_id=seller["id"],
        quantity=0
    )
    await db.inventory.insert_one(inventory.model_dump())
    if product.variants:
        await db.variant_inventory.insert_many([
            VariantInventory(
                product_id=product.id, variant_id=variant.id, seller_id=seller["id"], sku=variant.sku,
                stock_quantity=variant.stock_quantity, available_quantity=variant.stock_quantity,
                low_stock_threshold=variant.low_stock_limit,
            ).model_dump()
            for variant in product.variants
        ])
    
    return product


@api_router.get("/seller/products")
async def get_seller_products(
    q: Optional[str] = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    user: Dict[str, Any] = Depends(require_role([UserRole.SELLER])),
):
    seller = await db.sellers.find_one({"user_id": user["id"]})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    query: Dict[str, Any] = {"seller_id": seller["id"]}
    if q:
        pattern = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"name": pattern}, {"brand": pattern}, {"sku": pattern}]
    total = await db.products.count_documents(query)
    items = await db.products.find(query, {"_id": 0}).sort("updated_at", -1).skip(
        (page - 1) * page_size
    ).limit(page_size).to_list(page_size)
    return {
        "items": items, "total": total, "page": page, "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size),
    }


@api_router.get("/admin/products")
async def get_admin_products(
    q: Optional[str] = Query(default=None, max_length=100),
    active: Optional[bool] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN])),
):
    query: Dict[str, Any] = {}
    if active is not None:
        query["is_active"] = active
    if q:
        pattern = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"name": pattern}, {"brand": pattern}, {"sku": pattern}]
    total = await db.products.count_documents(query)
    items = await db.products.find(query, {"_id": 0, "cost_price": 0, "variants.cost_price": 0}).sort(
        "updated_at", -1
    ).skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    return {
        "items": items, "total": total, "page": page, "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size),
    }


async def operating_seller_for_product(product: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Resolve the legal inventory owner used by the single-brand admin workflow."""
    seller = None
    if product:
        seller = await db.sellers.find_one({"id": product.get("seller_id"), "status": SellerStatus.APPROVED.value}, {"_id": 0})
    configured_id = os.environ.get("OPERATING_SELLER_ID", "").strip()
    if not seller and configured_id:
        seller = await db.sellers.find_one({"id": configured_id, "status": SellerStatus.APPROVED.value}, {"_id": 0})
    if not seller:
        seller = await db.sellers.find_one({"status": SellerStatus.APPROVED.value}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=409, detail="Configure an approved operating business before managing products")
    return seller


@api_router.get("/admin/catalogue/products")
async def admin_catalogue_products(
    q: Optional[str] = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1), page_size: int = Query(default=24, ge=1, le=100),
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN])),
):
    query: Dict[str, Any] = {}
    if q:
        pattern = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"name": pattern}, {"brand": pattern}, {"sku": pattern}]
    total = await db.products.count_documents(query)
    items = await db.products.find(query, {"_id": 0}).sort("updated_at", -1).skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size, "pages": max(1, (total + page_size - 1) // page_size)}


@api_router.post("/admin/catalogue/products", response_model=Product)
async def admin_create_product(product_data: ProductCreate, user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))):
    seller = await operating_seller_for_product()
    product = await create_product(product_data, {"id": seller["user_id"], "role": UserRole.SELLER.value})
    await db.audit_logs.insert_one({"id": str(uuid.uuid4()), "actor_id": user["id"], "action": "admin.product_created", "entity_type": "product", "entity_id": product.id, "created_at": datetime.now(timezone.utc)})
    return product


@api_router.put("/admin/catalogue/products/{product_id}", response_model=Product)
async def admin_update_product(product_id: str, product_data: ProductCreate, user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    seller = await operating_seller_for_product(product)
    updated = await update_product(product_id, product_data, {"id": seller["user_id"], "role": UserRole.SELLER.value})
    await db.audit_logs.insert_one({"id": str(uuid.uuid4()), "actor_id": user["id"], "action": "admin.product_updated", "entity_type": "product", "entity_id": product_id, "created_at": datetime.now(timezone.utc)})
    return updated


@api_router.delete("/admin/catalogue/products/{product_id}")
async def admin_deactivate_product(product_id: str, user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    seller = await operating_seller_for_product(product)
    result = await delete_product(product_id, {"id": seller["user_id"], "role": UserRole.SELLER.value})
    await db.audit_logs.insert_one({"id": str(uuid.uuid4()), "actor_id": user["id"], "action": "admin.product_deactivated", "entity_type": "product", "entity_id": product_id, "created_at": datetime.now(timezone.utc)})
    return result


@api_router.patch("/admin/products/{product_id}/merchandising")
async def update_product_merchandising(
    product_id: str, payload: AdminProductMerchandisingUpdate,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN])),
):
    updates = {key: value for key, value in payload.model_dump().items() if value is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No merchandising changes supplied")
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await db.products.update_one({"id": product_id}, {"$set": updates})
    if result.matched_count != 1:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()), "actor_id": user["id"], "action": "product_merchandising_updated",
        "resource_type": "product", "resource_id": product_id, "changes": updates,
        "at": datetime.now(timezone.utc),
    })
    return await db.products.find_one(
        {"id": product_id}, {"_id": 0, "cost_price": 0, "variants.cost_price": 0}
    )

def public_product(product: Dict[str, Any]) -> Dict[str, Any]:
    """Remove seller/admin-only commercial data from customer responses."""
    result = {key: value for key, value in product.items() if key not in {"_id", "cost_price"}}
    result["variants"] = [
        {key: value for key, value in variant.items() if key != "cost_price"}
        for variant in result.get("variants", [])
    ]
    return result


@api_router.get("/products")
async def get_products(category: Optional[str] = None, seller_id: Optional[str] = None, coming_soon: bool = False):
    query = {"is_active": True, "is_coming_soon": True if coming_soon else {"$ne": True}}
    if category:
        query["category"] = category
    if seller_id:
        query["seller_id"] = seller_id
    
    products = await db.products.find(query, {"_id": 0}).to_list(1000)
    return [public_product(product) for product in products]

@api_router.get("/products/trending")
async def get_trending_products(limit: int = 10):
    # First try to get products with most orders
    pipeline = [
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit}
    ]
    
    trending_ids = []
    async for doc in db.orders.aggregate(pipeline):
        trending_ids.append(doc["_id"])
    
    products = []
    for product_id in trending_ids:
        product = await db.products.find_one({"id": product_id, "is_active": True}, {"_id": 0})
        if product:
            products.append(product)
    
    # If not enough products from orders, fill with random active products
    if len(products) < limit:
        additional = await db.products.find(
            {"is_active": True, "id": {"$nin": [p["id"] for p in products]}},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit - len(products)).to_list(limit - len(products))
        products.extend(additional)
    
    return [public_product(product) for product in products]

@api_router.get("/products/most-viewed")
async def get_most_viewed_products(limit: int = 10):
    # Get products with most views
    pipeline = [
        {"$group": {"_id": "$product_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit}
    ]
    
    most_viewed_ids = []
    async for doc in db.product_views.aggregate(pipeline):
        most_viewed_ids.append(doc["_id"])
    
    products = []
    for product_id in most_viewed_ids:
        product = await db.products.find_one({"id": product_id, "is_active": True}, {"_id": 0})
        if product:
            products.append(product)
    
    # If not enough viewed products, fill with random active products
    if len(products) < limit:
        additional = await db.products.find(
            {"is_active": True, "id": {"$nin": [p["id"] for p in products]}},
            {"_id": 0}
        ).limit(limit - len(products)).to_list(limit - len(products))
        products.extend(additional)
    
    return [public_product(product) for product in products]

@api_router.get("/products/similar/{product_id}")
async def get_similar_products(product_id: str, limit: int = 8):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Find similar products in same category
    similar = await db.products.find(
        {
            "category": product["category"],
            "is_active": True,
            "id": {"$ne": product_id}
        },
        {"_id": 0}
    ).limit(limit).to_list(limit)
    
    return [public_product(item) for item in similar]

@api_router.get("/catalog/products")
async def catalog_products(
    q: Optional[str] = Query(default=None, max_length=100),
    category: Optional[List[str]] = Query(default=None),
    brand: Optional[List[str]] = Query(default=None),
    target: Optional[List[str]] = Query(default=None),
    size: Optional[List[str]] = Query(default=None),
    concentration: Optional[List[str]] = Query(default=None),
    fragrance_family: Optional[List[str]] = Query(default=None),
    note: Optional[List[str]] = Query(default=None),
    occasion: Optional[List[str]] = Query(default=None),
    season: Optional[List[str]] = Query(default=None),
    longevity: Optional[List[str]] = Query(default=None),
    sillage: Optional[List[str]] = Query(default=None),
    min_price: Optional[float] = Query(default=None, ge=0),
    max_price: Optional[float] = Query(default=None, ge=0),
    min_rating: Optional[float] = Query(default=None, ge=0, le=5),
    min_discount: Optional[float] = Query(default=None, ge=0, le=100),
    in_stock: Optional[bool] = None,
    featured: Optional[bool] = None,
    bestseller: Optional[bool] = None,
    new_arrival: Optional[bool] = None,
    limited_edition: Optional[bool] = None,
    coming_soon: Optional[bool] = None,
    sort: str = Query(default="relevance", max_length=30),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=24, ge=1, le=100),
):
    """Backend-driven catalogue filtering with stable pagination and URL-safe query parameters."""
    query: Dict[str, Any] = {"is_active": True}
    query["is_coming_soon"] = True if coming_soon else {"$ne": True}
    if q:
        pattern = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [
            {"name": pattern}, {"brand": pattern}, {"sku": pattern},
            {"fragrance_family": pattern}, {"top_notes": pattern},
            {"middle_notes": pattern}, {"base_notes": pattern},
        ]
    dimensions = {
        "category": category, "brand": brand, "target_category": target,
        "sizes": size, "concentration": concentration,
        "fragrance_family": fragrance_family, "occasions": occasion,
        "seasons": season, "longevity": longevity, "sillage": sillage,
    }
    for field, values in dimensions.items():
        cleaned = [value for value in (values or []) if value]
        if cleaned:
            query[field] = {"$in": cleaned}
    if note:
        note_patterns = [{"$regex": re.escape(value), "$options": "i"} for value in note if value]
        if note_patterns:
            query["$and"] = [{"$or": [
                {"top_notes": {"$in": note_patterns}},
                {"middle_notes": {"$in": note_patterns}},
                {"base_notes": {"$in": note_patterns}},
            ]}]
    if min_price is not None or max_price is not None:
        query["price"] = {}
        if min_price is not None:
            query["price"]["$gte"] = min_price
        if max_price is not None:
            query["price"]["$lte"] = max_price
    if min_rating is not None:
        query["average_rating"] = {"$gte": min_rating}
    for field, value in {
        "is_featured": featured, "is_bestseller": bestseller,
        "is_new_arrival": new_arrival, "is_limited_edition": limited_edition,
        "is_coming_soon": coming_soon,
    }.items():
        if value is not None:
            query[field] = value

    sort_map = {
        "relevance": [("is_featured", -1), ("view_count", -1)],
        "popularity": [("view_count", -1)], "newest": [("created_at", -1)],
        "bestselling": [("is_bestseller", -1), ("view_count", -1)],
        "rating": [("average_rating", -1), ("review_count", -1)],
        "price_low": [("price", 1)], "price_high": [("price", -1)],
        "discount": [("mrp", -1), ("price", 1)],
        "name_asc": [("name", 1)], "name_desc": [("name", -1)],
    }
    if sort not in sort_map:
        raise HTTPException(status_code=422, detail="Unsupported catalogue sort option")

    raw_products = await db.products.find(query, {"_id": 0}).sort(sort_map[sort]).to_list(10000)
    if min_discount is not None:
        raw_products = [product for product in raw_products if product.get("mrp", 0) > 0 and ((product["mrp"] - product["price"]) / product["mrp"] * 100) >= min_discount]
    if in_stock is not None:
        stock_docs = await db.inventory.find({"quantity": {"$gt": 0} if in_stock else {"$lte": 0}}, {"_id": 0, "product_id": 1}).to_list(10000)
        stock_ids = {item["product_id"] for item in stock_docs}
        raw_products = [product for product in raw_products if product["id"] in stock_ids]

    total = len(raw_products)
    start = (page - 1) * page_size
    items = [public_product(product) for product in raw_products[start:start + page_size]]
    return {
        "items": items, "total": total, "page": page, "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }

@api_router.get("/catalog/bestsellers")
async def catalog_bestsellers(limit: int = Query(default=10, ge=1, le=50)):
    pipeline = [
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id", "quantity": {"$sum": "$items.quantity"}}},
        {"$sort": {"quantity": -1}}, {"$limit": limit},
    ]
    ranked_ids = [document["_id"] async for document in db.orders.aggregate(pipeline)]
    products = []
    for product_id in ranked_ids:
        product = await db.products.find_one({"id": product_id, "is_active": True}, {"_id": 0})
        if product:
            products.append(public_product(product))
    if len(products) < limit:
        fallback = await db.products.find(
            {"is_active": True, "id": {"$nin": [item["id"] for item in products]}}, {"_id": 0}
        ).sort([("is_bestseller", -1), ("created_at", -1)]).limit(limit - len(products)).to_list(limit - len(products))
        products.extend(public_product(product) for product in fallback)
    return products

@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    product = await db.products.find_one({"$or": [{"id": product_id}, {"slug": product_id}]}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return public_product(product)

@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(
    product_id: str,
    product_data: ProductCreate,
    user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))
):
    seller = await db.sellers.find_one({"user_id": user["id"]})
    product = await db.products.find_one({"id": product_id})
    
    if not seller or not product or product["seller_id"] != seller["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    slug = await validate_product_catalogue_payload(product_data, product_id)
    existing_inventory = await db.variant_inventory.find(
        {"product_id": product_id}, {"_id": 0}
    ).to_list(1000)
    inventory_by_variant = {item["variant_id"]: item for item in existing_inventory}
    incoming_ids = {variant.id for variant in product_data.variants}
    removed = [item for variant_id, item in inventory_by_variant.items() if variant_id not in incoming_ids]
    if any(int(item.get("reserved_quantity", 0)) > 0 for item in removed):
        raise HTTPException(status_code=409, detail="A variant with reserved stock cannot be removed")

    now = datetime.now(timezone.utc)
    for variant in product_data.variants:
        inventory = inventory_by_variant.get(variant.id)
        if inventory:
            await db.variant_inventory.update_one(
                {"id": inventory["id"]},
                {"$set": {"sku": variant.sku, "low_stock_threshold": variant.low_stock_limit, "updated_at": now}},
            )
        else:
            await db.variant_inventory.insert_one(VariantInventory(
                product_id=product_id, variant_id=variant.id, seller_id=seller["id"], sku=variant.sku,
                stock_quantity=variant.stock_quantity, available_quantity=variant.stock_quantity,
                low_stock_threshold=variant.low_stock_limit,
            ).model_dump())
            if variant.stock_quantity:
                await record_inventory_movement(
                    product_id=product_id, variant_id=variant.id, seller_id=seller["id"],
                    movement_type="initial_stock", quantity=variant.stock_quantity,
                    actor_id=user["id"], reason="Variant created",
                )
    if removed:
        await db.variant_inventory.delete_many({"id": {"$in": [item["id"] for item in removed]}})

    await db.products.update_one(
        {"id": product_id},
        {"$set": {
            **product_data.model_dump(), "slug": slug, "updated_at": now,
            "is_featured": product.get("is_featured", False),
            "is_bestseller": product.get("is_bestseller", False),
            "is_new_arrival": product.get("is_new_arrival", False),
            "is_limited_edition": product.get("is_limited_edition", False),
        }}
    )
    
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    return updated

@api_router.delete("/products/{product_id}")
async def delete_product(
    product_id: str,
    user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))
):
    seller = await db.sellers.find_one({"user_id": user["id"]})
    product = await db.products.find_one({"id": product_id})
    
    if not product or product["seller_id"] != seller["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.products.update_one({"id": product_id}, {"$set": {"is_active": False}})
    return {"message": "Product deleted"}

# ============== INVENTORY ROUTES ==============
async def record_inventory_movement(
    *, product_id: str, seller_id: str, movement_type: str, quantity: int,
    variant_id: Optional[str] = None, order_id: Optional[str] = None,
    actor_id: Optional[str] = None, reason: Optional[str] = None,
    session: Any = None,
) -> None:
    session_kwargs = {"session": session} if session is not None else {}
    await db.inventory_movements.insert_one({
        "id": str(uuid.uuid4()), "product_id": product_id, "variant_id": variant_id,
        "seller_id": seller_id, "type": movement_type, "quantity": quantity,
        "order_id": order_id, "actor_id": actor_id, "reason": reason,
        "created_at": datetime.now(timezone.utc),
    }, **session_kwargs)

@api_router.get("/inventory/my", response_model=List[Inventory])
async def get_my_inventory(user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))):
    seller = await db.sellers.find_one({"user_id": user["id"]})
    inventory = await db.inventory.find({"seller_id": seller["id"]}, {"_id": 0}).to_list(1000)
    return inventory

@api_router.put("/inventory/{product_id}")
async def update_inventory(
    product_id: str,
    inventory_data: InventoryUpdate,
    user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))
):
    seller = await db.sellers.find_one({"user_id": user["id"]})
    inventory = await db.inventory.find_one({"product_id": product_id})
    
    if not inventory or inventory["seller_id"] != seller["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {"quantity": inventory_data.quantity, "updated_at": datetime.now(timezone.utc).isoformat()}
    if inventory_data.low_stock_threshold is not None:
        update_data["low_stock_threshold"] = inventory_data.low_stock_threshold
    
    if inventory_data.quantity > inventory["quantity"]:
        update_data["last_restocked"] = datetime.now(timezone.utc).isoformat()
    
    await db.inventory.update_one({"product_id": product_id}, {"$set": update_data})
    await record_inventory_movement(
        product_id=product_id, seller_id=seller["id"], movement_type="manual_adjustment",
        quantity=inventory_data.quantity - inventory["quantity"], actor_id=user["id"],
        reason="Seller inventory update",
    )
    
    # Check low stock alert
    if inventory_data.quantity <= inventory.get("low_stock_threshold", 10):
        notification = Notification(
            user_id=user["id"],
            title="Low Stock Alert",
            message=f"Product {product_id} is running low on stock",
            type="order_update"
        )
        await db.notifications.insert_one(notification.model_dump())
    
    return {"message": "Inventory updated"}

@api_router.get("/inventory/variants", response_model=List[VariantInventory])
async def get_variant_inventory(user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))):
    seller = await db.sellers.find_one({"user_id": user["id"]})
    return await db.variant_inventory.find({"seller_id": seller["id"]}, {"_id": 0}).to_list(10000)

@api_router.put("/inventory/variants/{variant_id}", response_model=VariantInventory)
async def update_variant_inventory(
    variant_id: str,
    payload: VariantInventoryUpdate,
    user: Dict[str, Any] = Depends(require_role([UserRole.SELLER])),
):
    seller = await db.sellers.find_one({"user_id": user["id"]})
    inventory = await db.variant_inventory.find_one({"variant_id": variant_id, "seller_id": seller["id"]})
    if not inventory:
        raise HTTPException(status_code=404, detail="Variant inventory not found")
    reserved = int(inventory.get("reserved_quantity", 0))
    if payload.stock_quantity < reserved:
        raise HTTPException(status_code=409, detail="Stock cannot be lower than reserved quantity")
    update = {
        "stock_quantity": payload.stock_quantity,
        "available_quantity": payload.stock_quantity - reserved,
        "updated_at": datetime.now(timezone.utc),
    }
    if payload.low_stock_threshold is not None:
        update["low_stock_threshold"] = payload.low_stock_threshold
    await db.variant_inventory.update_one({"id": inventory["id"]}, {"$set": update})
    await record_inventory_movement(
        product_id=inventory["product_id"], variant_id=variant_id, seller_id=seller["id"],
        movement_type="manual_adjustment", quantity=payload.stock_quantity - inventory["stock_quantity"],
        actor_id=user["id"], reason="Seller variant inventory update",
    )
    return await db.variant_inventory.find_one({"id": inventory["id"]}, {"_id": 0})


@api_router.get("/admin/inventory/variants")
async def admin_variant_inventory(
    q: Optional[str] = Query(default=None, max_length=100),
    low_stock: Optional[bool] = None,
    page: int = Query(default=1, ge=1), page_size: int = Query(default=30, ge=1, le=100),
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN])),
):
    product_query: Dict[str, Any] = {}
    if q:
        pattern = {"$regex": re.escape(q.strip()), "$options": "i"}
        product_query["$or"] = [{"name": pattern}, {"brand": pattern}, {"sku": pattern}, {"variants.sku": pattern}]
    products = await db.products.find(product_query, {"_id": 0, "id": 1, "name": 1, "brand": 1, "images": 1, "variants": 1}).to_list(10000)
    products_by_id = {item["id"]: item for item in products}
    inventory = await db.variant_inventory.find({"product_id": {"$in": list(products_by_id)}}, {"_id": 0}).sort("updated_at", -1).to_list(10000)
    items = []
    for stock in inventory:
        product = products_by_id.get(stock["product_id"], {})
        variant = next((item for item in product.get("variants", []) if item.get("id") == stock["variant_id"]), {})
        enriched = {**stock, "product_name": product.get("name", "Product"), "brand": product.get("brand", "Perfurm"), "product_image": variant.get("image") or next(iter(product.get("images", [])), None), "size_label": variant.get("label") or (f"{variant['size_ml']:g} ml" if variant.get("size_ml") else stock.get("sku"))}
        if low_stock is None or (int(enriched.get("available_quantity", 0)) <= int(enriched.get("low_stock_threshold", 0))) == low_stock:
            items.append(enriched)
    total = len(items); start = (page - 1) * page_size
    return {"items": items[start:start + page_size], "total": total, "page": page, "page_size": page_size, "pages": max(1, (total + page_size - 1) // page_size)}


@api_router.put("/admin/inventory/variants/{variant_id}", response_model=VariantInventory)
async def admin_update_variant_inventory(
    variant_id: str, payload: VariantInventoryUpdate,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN])),
):
    inventory = await db.variant_inventory.find_one({"variant_id": variant_id}, {"_id": 0})
    if not inventory:
        raise HTTPException(status_code=404, detail="Variant inventory not found")
    seller = await operating_seller_for_product({"seller_id": inventory["seller_id"]})
    updated = await update_variant_inventory(variant_id, payload, {"id": seller["user_id"], "role": UserRole.SELLER.value})
    await db.audit_logs.insert_one({"id": str(uuid.uuid4()), "actor_id": user["id"], "action": "admin.inventory_adjusted", "entity_type": "variant", "entity_id": variant_id, "stock_quantity": payload.stock_quantity, "created_at": datetime.now(timezone.utc)})
    return updated

@api_router.get("/inventory/movements")
async def get_inventory_movements(
    page: int = Query(default=1, ge=1), page_size: int = Query(default=50, ge=1, le=200),
    user: Dict[str, Any] = Depends(require_role([UserRole.SELLER, UserRole.ADMIN])),
):
    query: Dict[str, Any] = {}
    if user["role"] == UserRole.SELLER.value:
        seller = await db.sellers.find_one({"user_id": user["id"]})
        query["seller_id"] = seller["id"]
    total = await db.inventory_movements.count_documents(query)
    items = await db.inventory_movements.find(query, {"_id": 0}).sort("created_at", -1).skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}

# ============== ORDER ROUTES ==============
async def _finalize_order_inventory(order: Dict[str, Any], session: Any = None) -> None:
    session_kwargs = {"session": session} if session is not None else {}
    claim = await db.orders.update_one(
        {"id": order["id"], "reservation_status": "reserved"},
        {"$set": {"reservation_status": "finalizing"}},
        **session_kwargs,
    )
    if claim.modified_count != 1:
        return
    for item in order.get("items", []):
        if item.get("inventory_kind") == "variant":
            result = await db.variant_inventory.update_one(
                {"variant_id": item["variant_id"], "reserved_quantity": {"$gte": item["quantity"]}},
                {"$inc": {"reserved_quantity": -item["quantity"], "stock_quantity": -item["quantity"]}},
                **session_kwargs,
            )
            if result.modified_count != 1:
                logger.error("Unable to finalize variant reservation for order %s", order["id"])
                raise HTTPException(status_code=409, detail="Inventory finalization failed")
            await record_inventory_movement(
                product_id=item["product_id"], variant_id=item["variant_id"], seller_id=item["seller_id"],
                movement_type="sale", quantity=-item["quantity"], order_id=order["id"], reason="Payment confirmed",
                session=session,
            )
        else:
            await record_inventory_movement(
                product_id=item["product_id"], seller_id=item["seller_id"],
                movement_type="sale", quantity=-item["quantity"], order_id=order["id"],
                reason="Payment confirmed", session=session,
            )
    await db.orders.update_one(
        {"id": order["id"], "reservation_status": "finalizing"},
        {"$set": {"reservation_status": "finalized", "inventory_finalized_at": datetime.now(timezone.utc)}},
        **session_kwargs,
    )


async def finalize_order_inventory(order: Dict[str, Any]) -> None:
    if USE_MOCK_DB:
        await _finalize_order_inventory(order)
        return
    async with await client.start_session() as mongo_session:
        async with mongo_session.start_transaction():
            await _finalize_order_inventory(order, session=mongo_session)


async def _release_order_coupon(order: Dict[str, Any], session: Any = None) -> None:
    """Release a coupon exactly once when an unpaid/cancelled order restores inventory."""
    if not order.get("coupon_id"):
        return
    session_kwargs = {"session": session} if session is not None else {}
    redemption = await db.coupon_redemptions.find_one_and_update(
        {"order_id": order["id"], "status": "active"},
        {"$set": {"status": "released", "released_at": datetime.now(timezone.utc)}},
        return_document=ReturnDocument.AFTER, **session_kwargs,
    )
    if not redemption:
        return
    await db.coupons.update_one(
        {"id": order["coupon_id"], "used_count": {"$gt": 0}}, {"$inc": {"used_count": -1}}, **session_kwargs,
    )
    await db.coupon_customer_usage.update_one(
        {"coupon_id": order["coupon_id"], "customer_id": order["customer_id"], "count": {"$gt": 0}},
        {"$inc": {"count": -1}, "$set": {"updated_at": datetime.now(timezone.utc)}}, **session_kwargs,
    )


async def mark_order_paid_and_finalize(
    order: Dict[str, Any], match: Dict[str, Any], payment_update: Dict[str, Any],
) -> bool:
    async def execute(session: Any = None) -> bool:
        session_kwargs = {"session": session} if session is not None else {}
        result = await db.orders.update_one(match, payment_update, **session_kwargs)
        if result.modified_count == 1:
            await _finalize_order_inventory(order, session=session)
            return True
        return False

    if USE_MOCK_DB:
        return await execute()
    async with await client.start_session() as mongo_session:
        async with mongo_session.start_transaction():
            return await execute(mongo_session)


async def _release_order_inventory(order: Dict[str, Any], session: Any = None) -> None:
    session_kwargs = {"session": session} if session is not None else {}
    original_status = order.get("reservation_status", "finalized")
    if original_status not in {"reserved", "finalized"}:
        return
    claim = await db.orders.update_one(
        {"id": order["id"], "reservation_status": original_status},
        {"$set": {"reservation_status": "releasing"}},
        **session_kwargs,
    )
    if claim.modified_count != 1:
        return
    for item in order.get("items", []):
        if item.get("inventory_kind") == "variant":
            if original_status == "reserved":
                await db.variant_inventory.update_one(
                    {"variant_id": item["variant_id"]},
                    {"$inc": {"available_quantity": item["quantity"], "reserved_quantity": -item["quantity"]}},
                    **session_kwargs,
                )
                movement_type = "reservation_released"
            else:
                await db.variant_inventory.update_one(
                    {"variant_id": item["variant_id"]},
                    {"$inc": {"available_quantity": item["quantity"], "stock_quantity": item["quantity"]}},
                    **session_kwargs,
                )
                movement_type = "cancellation_restock"
            await record_inventory_movement(
                product_id=item["product_id"], variant_id=item["variant_id"], seller_id=item["seller_id"],
                movement_type=movement_type, quantity=item["quantity"], order_id=order["id"], reason="Order cancelled",
                session=session,
            )
        else:
            await db.inventory.update_one(
                {"product_id": item["product_id"]},
                {"$inc": {"quantity": item["quantity"]}},
                **session_kwargs,
            )
            await record_inventory_movement(
                product_id=item["product_id"], seller_id=item["seller_id"],
                movement_type="reservation_released" if original_status == "reserved" else "cancellation_restock",
                quantity=item["quantity"], order_id=order["id"], reason="Order cancelled",
                session=session,
            )
    await db.orders.update_one(
        {"id": order["id"], "reservation_status": "releasing"},
        {"$set": {"reservation_status": "released", "inventory_released_at": datetime.now(timezone.utc)}},
        **session_kwargs,
    )
    await _release_order_coupon(order, session=session)


async def release_order_inventory(order: Dict[str, Any]) -> None:
    if USE_MOCK_DB:
        await _release_order_inventory(order)
        return
    async with await client.start_session() as mongo_session:
        async with mongo_session.start_transaction():
            await _release_order_inventory(order, session=mongo_session)


async def mark_order_failed_and_release(order: Dict[str, Any], payment_update: Dict[str, Any]) -> bool:
    async def execute(session: Any = None) -> bool:
        session_kwargs = {"session": session} if session is not None else {}
        result = await db.orders.update_one(
            {"id": order["id"], "payment_status": {"$ne": "paid"}}, payment_update, **session_kwargs,
        )
        if result.modified_count == 1:
            await _release_order_inventory(order, session=session)
            return True
        return False

    if USE_MOCK_DB:
        return await execute()
    async with await client.start_session() as mongo_session:
        async with mongo_session.start_transaction():
            return await execute(mongo_session)


async def expire_stale_payment_reservations(limit: int = 100) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=PAYMENT_RESERVATION_MINUTES)
    orders = await db.orders.find(
        {
            "reservation_status": "reserved",
            "payment_status": {"$in": ["pending", "payment_order_created"]},
            "created_at": {"$lte": cutoff},
        },
        {"_id": 0},
    ).sort("created_at", 1).limit(limit).to_list(limit)
    expired = 0
    for order in orders:
        now = datetime.now(timezone.utc)
        updated = await mark_order_failed_and_release(order, {
            "$set": {"payment_status": "expired", "status": OrderStatus.PAYMENT_FAILED.value, "expired_at": now},
            "$push": {
                "payment_history": {"status": "expired", "at": now, "source": "reservation_reaper"},
                "status_history": {"status": OrderStatus.PAYMENT_FAILED.value, "at": now, "source": "reservation_reaper"},
            },
        })
        expired += int(updated)
    return expired


@api_router.post("/admin/orders/release-expired-reservations")
async def release_expired_reservations_now(
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN])),
):
    return {"released": await expire_stale_payment_reservations(limit=1000)}


async def persist_checkout_order(
    order: Order, canonical_items: List[Dict[str, Any]], customer: Dict[str, Any],
    coupon: Optional[Dict[str, Any]] = None, session: Any = None,
) -> None:
    """Atomically persist the order, inventory, fee ledger and durable notifications.

    Real MongoDB calls this inside a transaction. The mock preview has no session support,
    so it uses the same operation order plus explicit compensation on failure.
    """
    session_kwargs = {"session": session} if session is not None else {}
    applied_items: List[Dict[str, Any]] = []
    coupon_global_claimed = False
    coupon_customer_claimed = False
    try:
        # Claim the idempotency key before touching inventory. The unique compound index
        # makes concurrent duplicate checkouts resolve to one durable order.
        await db.orders.insert_one(order.model_dump(), **session_kwargs)

        if coupon:
            # Optimistic counters make global and per-customer limits safe under concurrency.
            expected_used = int(coupon.get("used_count", 0))
            coupon_result = await db.coupons.update_one(
                {"id": coupon["id"], "is_active": True, "used_count": expected_used},
                {"$inc": {"used_count": 1}}, **session_kwargs,
            )
            if coupon_result.modified_count != 1:
                raise HTTPException(status_code=409, detail="Coupon availability changed; please retry")
            coupon_global_claimed = True

            customer_usage = await db.coupon_customer_usage.find_one(
                {"coupon_id": coupon["id"], "customer_id": customer["id"]}, **session_kwargs,
            )
            usage_limit = coupon.get("per_customer_usage_limit")
            if customer_usage:
                expected_customer_count = int(customer_usage.get("count", 0))
                if usage_limit and expected_customer_count >= usage_limit:
                    raise HTTPException(status_code=400, detail="Coupon usage limit reached for this account")
                usage_result = await db.coupon_customer_usage.update_one(
                    {"coupon_id": coupon["id"], "customer_id": customer["id"], "count": expected_customer_count},
                    {"$inc": {"count": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}},
                    **session_kwargs,
                )
                if usage_result.modified_count != 1:
                    raise HTTPException(status_code=409, detail="Coupon usage changed; please retry")
            else:
                await db.coupon_customer_usage.insert_one({
                    "coupon_id": coupon["id"], "customer_id": customer["id"], "count": 1,
                    "updated_at": datetime.now(timezone.utc),
                }, **session_kwargs)
            coupon_customer_claimed = True
            await db.coupon_redemptions.insert_one({
                "id": str(uuid.uuid4()), "coupon_id": coupon["id"], "coupon_code": coupon["code"],
                "customer_id": customer["id"], "order_id": order.id, "discount_amount": order.discount_amount,
                "status": "active", "created_at": datetime.now(timezone.utc),
            }, **session_kwargs)

        for item in canonical_items:
            if item["inventory_kind"] == "variant":
                if order.payment_method == "cod":
                    result = await db.variant_inventory.update_one(
                        {
                            "variant_id": item["variant_id"],
                            "available_quantity": {"$gte": item["quantity"]},
                            "stock_quantity": {"$gte": item["quantity"]},
                        },
                        {"$inc": {"available_quantity": -item["quantity"], "stock_quantity": -item["quantity"]}},
                        **session_kwargs,
                    )
                    movement_type = "sale"
                else:
                    result = await db.variant_inventory.update_one(
                        {"variant_id": item["variant_id"], "available_quantity": {"$gte": item["quantity"]}},
                        {"$inc": {"available_quantity": -item["quantity"], "reserved_quantity": item["quantity"]}},
                        **session_kwargs,
                    )
                    movement_type = "reservation"
            else:
                result = await db.inventory.update_one(
                    {"product_id": item["product_id"], "quantity": {"$gte": item["quantity"]}},
                    {"$inc": {"quantity": -item["quantity"]}}, **session_kwargs,
                )
                movement_type = "sale" if order.payment_method == "cod" else "reservation"
            if result.modified_count != 1:
                raise HTTPException(status_code=409, detail=f"Stock changed for {item['name']}; please retry")
            applied_items.append(item)
            await record_inventory_movement(
                product_id=item["product_id"], variant_id=item.get("variant_id"), seller_id=item["seller_id"],
                movement_type=movement_type, quantity=-item["quantity"], order_id=order.id,
                actor_id=customer["id"], reason="Checkout inventory hold" if movement_type == "reservation" else "Order confirmed",
                session=session,
            )

        seller_items: Dict[str, List[Dict[str, Any]]] = {}
        for item in canonical_items:
            seller_items.setdefault(item["seller_id"], []).append(item)
        for seller_id, items in seller_items.items():
            seller_gross = sum(item["price"] * item["quantity"] for item in items)
            discount_share = round(
                order.discount_amount * (seller_gross / order.subtotal), 2
            ) if order.subtotal else 0
            seller_order_amount = round(max(seller_gross - discount_share, 0), 2)
            seller_fee_calc = calculate_platform_fee(seller_order_amount, 2.0)
            platform_fee = PlatformFee(
                order_id=order.id, seller_id=seller_id, order_amount=seller_order_amount,
                fee_percentage=2.0, fee_amount=seller_fee_calc["fee_amount"],
                seller_payout=seller_fee_calc["seller_payout"], status="pending",
            )
            await db.platform_fees.insert_one(platform_fee.model_dump(), **session_kwargs)
            seller = await db.sellers.find_one({"id": seller_id}, **session_kwargs)
            if seller:
                notification = Notification(
                    user_id=seller["user_id"], title="New Order Received",
                    message=f"Order #{order.id} - {len(items)} items | Payout: ₹{seller_fee_calc['seller_payout']} (After 2% platform fee)",
                    type="order_update",
                )
                notification_document = {**notification.model_dump(), "order_id": order.id}
                await db.notifications.insert_one(notification_document, **session_kwargs)

        product_names = ", ".join(dict.fromkeys(str(item.get("name") or "Product") for item in canonical_items))
        customer_notification = Notification(
            user_id=customer["id"], title="Order Placed",
            message=f"Your order #{order.id} for {product_names} has been placed successfully",
            type="order_update", link_url="/customer/orders",
        )
        await db.notifications.insert_one(
            {**customer_notification.model_dump(), "order_id": order.id}, **session_kwargs,
        )
    except Exception:
        if session is None:
            # Preview/mock databases cannot transact; restore every applied stock move
            # and remove all order-scoped durable records before surfacing the error.
            for item in reversed(applied_items):
                if item["inventory_kind"] == "variant":
                    if order.payment_method == "cod":
                        update = {"$inc": {"available_quantity": item["quantity"], "stock_quantity": item["quantity"]}}
                    else:
                        update = {"$inc": {"available_quantity": item["quantity"], "reserved_quantity": -item["quantity"]}}
                    await db.variant_inventory.update_one({"variant_id": item["variant_id"]}, update)
                else:
                    await db.inventory.update_one(
                        {"product_id": item["product_id"]}, {"$inc": {"quantity": item["quantity"]}}
                    )
            await db.inventory_movements.delete_many({"order_id": order.id})
            await db.platform_fees.delete_many({"order_id": order.id})
            await db.notifications.delete_many({"order_id": order.id})
            await db.orders.delete_one({"id": order.id})
            if coupon and coupon_global_claimed:
                await db.coupons.update_one({"id": coupon["id"], "used_count": {"$gt": 0}}, {"$inc": {"used_count": -1}})
            if coupon and coupon_customer_claimed:
                await db.coupon_customer_usage.update_one(
                    {"coupon_id": coupon["id"], "customer_id": customer["id"], "count": {"$gt": 0}},
                    {"$inc": {"count": -1}},
                )
            if coupon:
                await db.coupon_redemptions.delete_many({"order_id": order.id})
        raise

def _coupon_datetime(value: Any) -> datetime:
    parsed = datetime.fromisoformat(value) if isinstance(value, str) else value
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def calculate_coupon_discount(coupon: Dict[str, Any], subtotal: float) -> float:
    if subtotal < float(coupon.get("min_order_amount", 0)):
        raise HTTPException(
            status_code=400,
            detail=f"Minimum order amount is ₹{coupon.get('min_order_amount', 0):g}",
        )
    if coupon["discount_type"] == "percentage":
        discount = subtotal * (float(coupon["discount_value"]) / 100)
        if coupon.get("max_discount") is not None:
            discount = min(discount, float(coupon["max_discount"]))
    else:
        discount = float(coupon["discount_value"])
    return round(min(max(discount, 0), subtotal), 2)


async def resolve_checkout_coupon(code: str, subtotal: float, customer_id: str) -> tuple[Dict[str, Any], float]:
    normalized_code = code.strip().upper()
    if not re.fullmatch(r"[A-Z0-9_-]{3,40}", normalized_code):
        raise HTTPException(status_code=400, detail="Invalid coupon code")
    coupon = await db.coupons.find_one({"code": normalized_code, "is_active": True}, {"_id": 0})
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found or inactive")
    now = datetime.now(timezone.utc)
    if now < _coupon_datetime(coupon["valid_from"]) or now > _coupon_datetime(coupon["valid_until"]):
        raise HTTPException(status_code=400, detail="Coupon has expired or is not yet valid")
    if coupon.get("usage_limit") and int(coupon.get("used_count", 0)) >= int(coupon["usage_limit"]):
        raise HTTPException(status_code=400, detail="Coupon usage limit reached")
    customer_usage = await db.coupon_customer_usage.find_one(
        {"coupon_id": coupon["id"], "customer_id": customer_id}, {"_id": 0},
    )
    per_customer_limit = coupon.get("per_customer_usage_limit")
    if per_customer_limit and int((customer_usage or {}).get("count", 0)) >= int(per_customer_limit):
        raise HTTPException(status_code=400, detail="Coupon usage limit reached for this account")
    audience = coupon.get("audience_type", "all")
    if audience == "specific_users" and customer_id not in coupon.get("eligible_user_ids", []):
        raise HTTPException(status_code=403, detail="This coupon is not assigned to your account")
    if audience in {"first_order", "completed_orders"}:
        completed = await db.orders.count_documents({"customer_id": customer_id, "status": OrderStatus.DELIVERED.value})
        if audience == "first_order" and completed > 0:
            raise HTTPException(status_code=403, detail="This coupon is only for a first purchase")
        if audience == "completed_orders" and completed < int(coupon.get("min_completed_orders") or 1):
            raise HTTPException(status_code=403, detail=f"Complete {coupon.get('min_completed_orders')} orders to unlock this coupon")
    return coupon, calculate_coupon_discount(coupon, subtotal)


async def build_checkout_quote(items: List[Dict[str, Any]], pincode: str, state: str, coupon_code: Optional[str], customer_id: str) -> Dict[str, Any]:
    if not items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")
    if not re.fullmatch(r"\d{6}", str(pincode)):
        raise HTTPException(status_code=400, detail="A valid shipping pincode is required")
    serviceability = await db.pincode_rules.find_one({"pincode": str(pincode), "is_active": True}, {"_id": 0})
    if not serviceability:
        raise HTTPException(status_code=400, detail="Delivery is not available for this pincode")
    product_ids = list({item.get("product_id") for item in items if item.get("product_id")})
    products = await db.products.find({"id": {"$in": product_ids}, "is_active": True}, {"_id": 0}).to_list(len(product_ids) or 1)
    products_by_id = {product["id"]: product for product in products}
    canonical_items, calculated_subtotal = [], 0.0
    for item in items:
        product_id, quantity = item.get("product_id"), item.get("quantity")
        if not product_id or not isinstance(quantity, int) or quantity < 1:
            raise HTTPException(status_code=400, detail="Each item requires a valid product and positive quantity")
        product = products_by_id.get(product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {product_id} not found")
        if product.get("is_coming_soon"):
            raise HTTPException(status_code=409, detail=f"{product['name']} is coming soon and cannot be ordered yet")
        active_variants = [variant for variant in product.get("variants", []) if variant.get("is_active", True)]
        selected_variant = None
        if active_variants:
            selected_variant = next((variant for variant in active_variants if variant.get("id") == item.get("variant_id")), None)
            if not selected_variant and item.get("size"):
                selected_variant = next((variant for variant in active_variants if variant.get("label") == item["size"] or (variant.get("size_ml") and f"{variant['size_ml']:g} ml" == item["size"])), None)
            if not selected_variant:
                raise HTTPException(status_code=400, detail=f"Select an available variant for {product['name']}")
            inventory = await db.variant_inventory.find_one({"variant_id": selected_variant["id"]}, {"_id": 0, "available_quantity": 1})
            if not inventory or int(inventory.get("available_quantity", 0)) < quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for {product['name']}")
        else:
            inventory = await db.inventory.find_one({"product_id": product_id})
            if not inventory or inventory["quantity"] < quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for {product['name']}")
        price = float(selected_variant["price"] if selected_variant else product["price"])
        product_image = selected_variant.get("image") if selected_variant else None
        if not product_image:
            product_image = next((image for image in product.get("images", []) if image), None)
        line = {"product_id": product["id"], "seller_id": product["seller_id"], "name": product["name"], "image": product_image, "price": price, "quantity": quantity, "inventory_kind": "variant" if selected_variant else "legacy", "gst_category": product.get("gst_category")}
        if selected_variant:
            line.update({"variant_id": selected_variant["id"], "variant_sku": selected_variant["sku"], "size": selected_variant.get("label") or (f"{selected_variant['size_ml']:g} ml" if selected_variant.get("size_ml") else None)})
        for option in (("color",) if selected_variant else ("size", "color")):
            if item.get(option): line[option] = item[option]
        canonical_items.append(line); calculated_subtotal += price * quantity
    subtotal = round(calculated_subtotal, 2)
    coupon, discount_amount = None, 0.0
    if coupon_code: coupon, discount_amount = await resolve_checkout_coupon(coupon_code, subtotal, customer_id)
    taxable_amount = round(max(subtotal - discount_amount, 0), 2)
    platform_settings = await db.platform_settings.find_one({"id": "platform_settings"}, {"_id": 0}) or PlatformSettings().model_dump()
    tax_percentage = float(platform_settings.get("gst_percentage", 18.0))
    tax_amount = round(taxable_amount * tax_percentage / (100 + tax_percentage), 2) if TAX_PRICES_INCLUDE_GST and tax_percentage else round(taxable_amount * tax_percentage / 100, 2)
    intra_state = state.strip().casefold() == TAX_ORIGIN_STATE.casefold()
    cgst_amount = round(tax_amount / 2, 2) if intra_state else 0.0
    sgst_amount = round(tax_amount - cgst_amount, 2) if intra_state else 0.0
    igst_amount = tax_amount if not intra_state else 0.0
    shipping_charge = round(float(serviceability.get("delivery_charge", 0)), 2)
    total_amount = round(taxable_amount + shipping_charge + (0 if TAX_PRICES_INCLUDE_GST else tax_amount), 2)
    return {"items": canonical_items, "subtotal": subtotal, "discount_amount": discount_amount, "taxable_amount": taxable_amount, "tax_percentage": tax_percentage, "tax_amount": tax_amount, "tax_inclusive": TAX_PRICES_INCLUDE_GST, "cgst_amount": cgst_amount, "sgst_amount": sgst_amount, "igst_amount": igst_amount, "shipping_charge": shipping_charge, "total_amount": total_amount, "coupon": coupon, "delivery": {"estimated_delivery_days": serviceability.get("delivery_days"), "cod_available": serviceability.get("cod_available", False)}}


@api_router.post("/checkout/quote")
async def quote_checkout(payload: CheckoutQuoteRequest, user: Dict[str, Any] = Depends(require_role([UserRole.CUSTOMER]))):
    if user.get("deletion_pending"):
        raise HTTPException(status_code=409, detail="Checkout is unavailable while account deletion is approved")
    quote = await build_checkout_quote(payload.items, payload.pincode, payload.state, payload.coupon_code, user["id"])
    return {key: value for key, value in quote.items() if key != "coupon"}


@api_router.post("/orders", response_model=Order)
async def create_order(
    order_data: OrderCreate,
    request: Request,
    user: Dict[str, Any] = Depends(require_role([UserRole.CUSTOMER]))
):
    if user.get("deletion_pending"):
        raise HTTPException(status_code=409, detail="Checkout is unavailable while account deletion is approved")
    idempotency_key = request.headers.get("Idempotency-Key")
    if APP_ENV in {"staging", "production"} and not idempotency_key:
        raise HTTPException(status_code=400, detail="Idempotency-Key header is required")
    if idempotency_key:
        if len(idempotency_key) > 128:
            raise HTTPException(status_code=400, detail="Idempotency-Key is too long")
        existing_order = await db.orders.find_one(
            {"customer_id": user["id"], "idempotency_key": idempotency_key}, {"_id": 0}
        )
        if existing_order:
            return existing_order
    quote = await build_checkout_quote(
        order_data.items, str(order_data.shipping_address.get("pincode", "")),
        str(order_data.shipping_address.get("state", "")), order_data.coupon_code, user["id"],
    )
    canonical_items = quote["items"]
    subtotal, discount_amount = quote["subtotal"], quote["discount_amount"]
    taxable_amount, tax_percentage, tax_amount = quote["taxable_amount"], quote["tax_percentage"], quote["tax_amount"]
    cgst_amount, sgst_amount, igst_amount = quote["cgst_amount"], quote["sgst_amount"], quote["igst_amount"]
    shipping_charge, calculated_total, coupon = quote["shipping_charge"], quote["total_amount"], quote["coupon"]
    fee_calculation = calculate_platform_fee(taxable_amount, 2.0)
    
    order = Order(
        customer_id=user["id"],
        status=OrderStatus.CONFIRMED if order_data.payment_method == "cod" else OrderStatus.PENDING,
        payment_status="cod_pending" if order_data.payment_method == "cod" else "pending",
        payment_method=order_data.payment_method,
        reservation_status="finalized" if order_data.payment_method == "cod" else "reserved",
        idempotency_key=idempotency_key,
        status_history=[{
            "status": OrderStatus.CONFIRMED.value if order_data.payment_method == "cod" else OrderStatus.PENDING.value,
            "at": datetime.now(timezone.utc),
            "actor_id": user["id"],
            "source": "checkout",
        }],
        platform_fee_percentage=2.0,
        platform_fee_amount=fee_calculation["fee_amount"],
        seller_payout=fee_calculation["seller_payout"],
        items=canonical_items,
        subtotal=subtotal,
        shipping_charge=shipping_charge,
        discount_amount=discount_amount,
        taxable_amount=taxable_amount,
        tax_percentage=tax_percentage,
        tax_amount=tax_amount,
        tax_inclusive=quote["tax_inclusive"],
        cgst_amount=cgst_amount,
        sgst_amount=sgst_amount,
        igst_amount=igst_amount,
        coupon_code=coupon["code"] if coupon else None,
        coupon_id=coupon["id"] if coupon else None,
        total_amount=calculated_total,
        shipping_address=order_data.shipping_address
    )
    
    try:
        if USE_MOCK_DB:
            await persist_checkout_order(order, canonical_items, user, coupon=coupon)
        else:
            async with await client.start_session() as mongo_session:
                async with mongo_session.start_transaction():
                    await persist_checkout_order(order, canonical_items, user, coupon=coupon, session=mongo_session)
    except DuplicateKeyError:
        if idempotency_key:
            existing_order = await db.orders.find_one(
                {"customer_id": user["id"], "idempotency_key": idempotency_key}, {"_id": 0}
            )
            if existing_order:
                return existing_order
        raise HTTPException(status_code=409, detail="Order already exists")

    return order

@api_router.get("/orders/my", response_model=List[Order])
async def get_my_orders(user: Dict[str, Any] = Depends(get_current_user)):
    if user["role"] == UserRole.CUSTOMER.value:
        orders = await db.orders.find({"customer_id": user["id"]}, {"_id": 0}).to_list(1000)
    elif user["role"] == UserRole.SELLER.value:
        seller = await db.sellers.find_one({"user_id": user["id"]})
        if not seller:
            raise HTTPException(status_code=404, detail="Seller profile not found")
        orders = await db.orders.find(
            {"items.seller_id": seller["id"]},
            {"_id": 0}
        ).to_list(1000)
    elif user["role"] == UserRole.ADMIN.value:
        orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
    elif user["role"] == UserRole.DELIVERY_PARTNER.value:
        partner = await db.delivery_partners.find_one({"user_id": user["id"]})
        if not partner:
            raise HTTPException(status_code=404, detail="Delivery partner profile not found")
        orders = await db.orders.find({"delivery_partner_id": partner["id"]}, {"_id": 0}).to_list(1000)
    else:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Add images to legacy orders without changing their immutable price/tax snapshots.
    missing_product_ids = list({
        item.get("product_id") for order in orders for item in order.get("items", [])
        if item.get("product_id") and not item.get("image")
    })
    if missing_product_ids:
        products = await db.products.find({"id": {"$in": missing_product_ids}}, {"_id": 0, "id": 1, "images": 1}).to_list(len(missing_product_ids))
        images_by_product = {product["id"]: next((image for image in product.get("images", []) if image), None) for product in products}
        for order in orders:
            for item in order.get("items", []):
                item["image"] = item.get("image") or images_by_product.get(item.get("product_id"))
    return orders

@api_router.get("/admin/orders")
async def admin_orders(
    q: Optional[str] = Query(default=None, max_length=100),
    order_status: Optional[str] = None,
    payment_status: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN])),
):
    query: Dict[str, Any] = {}
    if q:
        pattern = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"id": pattern}, {"tracking_id": pattern}, {"payment_id": pattern}]
    if order_status:
        query["status"] = order_status
    if payment_status:
        query["payment_status"] = payment_status
    total = await db.orders.count_documents(query)
    items = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    return {
        "items": items, "total": total, "page": page, "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }

@api_router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Authorization check
    if user["role"] == UserRole.CUSTOMER.value and order["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if user["role"] == UserRole.SELLER.value:
        seller = await db.sellers.find_one({"user_id": user["id"]})
        if not seller or not any(item.get("seller_id") == seller["id"] for item in order.get("items", [])):
            raise HTTPException(status_code=403, detail="Not authorized")
    if user["role"] == UserRole.DELIVERY_PARTNER.value:
        partner = await db.delivery_partners.find_one({"user_id": user["id"]})
        if not partner or order.get("delivery_partner_id") != partner["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    return order

async def invoice_order_access(order_id: str, user: Dict[str, Any]) -> tuple[Dict[str, Any], Optional[str]]:
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order: raise HTTPException(status_code=404, detail="Order not found")
    seller_filter = None
    if user["role"] == UserRole.CUSTOMER.value and order["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if user["role"] == UserRole.SELLER.value:
        seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
        if not seller or not any(item.get("seller_id") == seller["id"] for item in order.get("items", [])):
            raise HTTPException(status_code=403, detail="Not authorized")
        seller_filter = seller["id"]
    if user["role"] not in {UserRole.CUSTOMER.value, UserRole.SELLER.value, UserRole.ADMIN.value}:
        raise HTTPException(status_code=403, detail="Not authorized")
    return order, seller_filter

def indian_financial_year(at: datetime) -> str:
    year = at.year if at.month >= 4 else at.year - 1
    return f"{year % 100:02d}-{(year + 1) % 100:02d}"

async def generate_order_invoices(order: Dict[str, Any]) -> List[Dict[str, Any]]:
    existing = await db.invoices.find({"order_id": order["id"]}, {"_id": 0}).sort("invoice_number", 1).to_list(100)
    if existing: return existing
    if not order.get("invoice_eligible", False) or "tax_percentage" not in order:
        raise HTTPException(status_code=409, detail="Legacy order requires tax review before invoicing")
    if order.get("status") in {OrderStatus.PENDING.value, OrderStatus.PAYMENT_PENDING.value, OrderStatus.PAYMENT_FAILED.value, OrderStatus.CANCELLED.value}:
        raise HTTPException(status_code=409, detail="Invoice is not available for this order status")
    if order.get("payment_method") == "online" and order.get("payment_status") != "paid":
        raise HTTPException(status_code=409, detail="Online payment must be captured before invoicing")
    groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for item in order.get("items", []): groups[item["seller_id"]].append(item)
    seller_ids = list(groups); sellers = await db.sellers.find({"id": {"$in": seller_ids}}, {"_id": 0}).to_list(len(seller_ids))
    sellers_by_id = {seller["id"]: seller for seller in sellers}
    now, financial_year = datetime.now(timezone.utc), indian_financial_year(datetime.now(timezone.utc))
    invoices = []
    subtotal = float(order.get("subtotal", 0)) or 1
    allocated_discount = allocated_shipping = allocated_tax = 0.0
    for index, seller_id in enumerate(seller_ids):
        seller, lines = sellers_by_id.get(seller_id), groups[seller_id]
        if not seller: raise HTTPException(status_code=409, detail="Seller record required for invoice")
        if APP_ENV in {"staging", "production"} and float(order.get("tax_amount", 0)) > 0 and not seller.get("gst_number"):
            raise HTTPException(status_code=409, detail=f"Verified seller GSTIN required for {seller['business_name']}")
        gross = round(sum(float(line["price"]) * int(line["quantity"]) for line in lines), 2)
        last = index == len(seller_ids) - 1
        discount = round(float(order.get("discount_amount", 0)) - allocated_discount, 2) if last else round(float(order.get("discount_amount", 0)) * gross / subtotal, 2)
        shipping = round(float(order.get("shipping_charge", 0)) - allocated_shipping, 2) if last else round(float(order.get("shipping_charge", 0)) * gross / subtotal, 2)
        tax = round(float(order.get("tax_amount", 0)) - allocated_tax, 2) if last else round(float(order.get("tax_amount", 0)) * gross / subtotal, 2)
        allocated_discount += discount; allocated_shipping += shipping; allocated_tax += tax
        net_items = round(max(gross - discount, 0), 2)
        # GST invoices show the pre-tax assessable value even when storefront
        # prices are tax-inclusive. The customer-facing order total remains net.
        taxable = round(max(net_items - tax, 0), 2) if order.get("tax_inclusive", True) else net_items
        intra = float(order.get("igst_amount", 0)) == 0
        counter = await db.counters.find_one_and_update({"id": f"invoice:{financial_year}"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER)
        invoice_number = f"PF/{financial_year}/{int(counter['seq']):08d}"
        invoice = {
            "id": str(uuid.uuid4()), "invoice_number": invoice_number, "financial_year": financial_year,
            "order_id": order["id"], "customer_id": order["customer_id"], "seller_id": seller_id,
            "seller": {"business_name": seller["business_name"], "gst_number": seller.get("gst_number"), "address": seller.get("address"), "city": seller.get("city"), "state": seller.get("state"), "pincode": seller.get("pincode")},
            "billing_address": order.get("shipping_address", {}), "items": lines,
            "subtotal": gross, "discount_amount": discount, "taxable_amount": taxable,
            "tax_percentage": float(order.get("tax_percentage", 0)), "tax_amount": tax,
            "tax_inclusive": bool(order.get("tax_inclusive", True)),
            "cgst_amount": round(tax / 2, 2) if intra else 0, "sgst_amount": round(tax - round(tax / 2, 2), 2) if intra else 0, "igst_amount": tax if not intra else 0,
            "shipping_charge": shipping, "total_amount": round(taxable + tax + shipping, 2),
            "payment_method": order.get("payment_method"), "payment_id": order.get("payment_id"),
            "issued_at": now, "immutable": True,
        }
        try: await db.invoices.insert_one(invoice.copy())
        except DuplicateKeyError: pass
        invoices.append(invoice)
    await db.audit_logs.insert_one({"id": str(uuid.uuid4()), "actor_id": "system", "action": "invoice.generated", "entity_type": "order", "entity_id": order["id"], "invoice_numbers": [item["invoice_number"] for item in invoices], "created_at": now})
    return await db.invoices.find({"order_id": order["id"]}, {"_id": 0}).sort("invoice_number", 1).to_list(100)

@api_router.post("/orders/{order_id}/invoices")
async def create_order_invoices(order_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    order, seller_filter = await invoice_order_access(order_id, user)
    invoices = await generate_order_invoices(order)
    return [invoice for invoice in invoices if not seller_filter or invoice["seller_id"] == seller_filter]

@api_router.get("/orders/{order_id}/invoices")
async def get_order_invoices(order_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    _, seller_filter = await invoice_order_access(order_id, user)
    query = {"order_id": order_id, **({"seller_id": seller_filter} if seller_filter else {})}
    return await db.invoices.find(query, {"_id": 0}).sort("invoice_number", 1).to_list(100)

@api_router.get("/orders/{order_id}/invoice-download")
async def download_order_invoice(order_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    _, seller_filter = await invoice_order_access(order_id, user)
    query = {"order_id": order_id, **({"seller_id": seller_filter} if seller_filter else {})}
    invoices = await db.invoices.find(query, {"_id": 0}).sort("invoice_number", 1).to_list(100)
    if not invoices: raise HTTPException(status_code=404, detail="Generate the invoice before downloading")
    sections = []
    for invoice in invoices:
        rows = "".join(f"<tr><td>{html.escape(str(item.get('name','')))}</td><td>{html.escape(str(item.get('size','—')))}</td><td>{item['quantity']}</td><td>₹{float(item['price']):.2f}</td><td>₹{float(item['price']) * int(item['quantity']):.2f}</td></tr>" for item in invoice["items"])
        seller = invoice["seller"]; address = invoice["billing_address"]
        sections.append(f"<section><h1>Tax Invoice {html.escape(invoice['invoice_number'])}</h1><p><b>Supplier:</b> {html.escape(seller['business_name'])}<br><b>GSTIN:</b> {html.escape(str(seller.get('gst_number') or 'Unregistered'))}<br>{html.escape(str(seller.get('address') or ''))}, {html.escape(str(seller.get('state') or ''))}</p><p><b>Order:</b> {html.escape(order_id)}<br><b>Issued:</b> {invoice['issued_at'].strftime('%d %b %Y')}<br><b>Bill to:</b> {html.escape(str(address.get('name','')))}, {html.escape(str(address.get('address_line') or address.get('address_line1','')))}, {html.escape(str(address.get('city','')))} {html.escape(str(address.get('pincode','')))}</p><table><thead><tr><th>Item</th><th>Size</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{rows}</tbody></table><div class='totals'>Subtotal ₹{invoice['subtotal']:.2f}<br>Discount −₹{invoice['discount_amount']:.2f}<br>Taxable ₹{invoice['taxable_amount']:.2f}<br>CGST ₹{invoice['cgst_amount']:.2f} · SGST ₹{invoice['sgst_amount']:.2f} · IGST ₹{invoice['igst_amount']:.2f}<br>Shipping ₹{invoice['shipping_charge']:.2f}<br><b>Total ₹{invoice['total_amount']:.2f}</b><br><small>GST is {'included in item prices' if invoice['tax_inclusive'] else 'charged additionally'}.</small></div></section>")
    document = f"<!doctype html><html><head><meta charset='utf-8'><title>Perfurm invoice {html.escape(order_id)}</title><style>body{{font:14px Arial;color:#292524;margin:32px}}section{{max-width:900px;margin:0 auto 48px;page-break-after:always}}h1{{font-family:Georgia;color:#6f3b49}}table{{width:100%;border-collapse:collapse;margin:24px 0}}th,td{{padding:10px;border:1px solid #d6d3d1;text-align:left}}.totals{{margin-left:auto;max-width:360px;text-align:right;line-height:1.8}}@media print{{body{{margin:0}}}}</style></head><body>{''.join(sections)}</body></html>"
    return Response(content=document, media_type="text/html", headers={"Content-Disposition": f'attachment; filename="perfurm-invoice-{order_id}.html"', "Cache-Control": "private, no-store"})

@api_router.put("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    status: OrderStatus,
    user: Dict[str, Any] = Depends(require_role([UserRole.SELLER, UserRole.ADMIN]))
):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if user["role"] == UserRole.SELLER.value:
        seller = await db.sellers.find_one({"user_id": user["id"]})
        if not seller or not any(item.get("seller_id") == seller["id"] for item in order.get("items", [])):
            raise HTTPException(status_code=403, detail="Not authorized to update this order")
        if status in {OrderStatus.REFUND_INITIATED, OrderStatus.REFUNDED, OrderStatus.RETURN_APPROVED, OrderStatus.RETURN_REJECTED}:
            raise HTTPException(status_code=403, detail="This transition requires an administrator")

    current_status = OrderStatus(order.get("status", OrderStatus.PENDING.value))
    allowed_transitions = {
        OrderStatus.PENDING: {OrderStatus.PAYMENT_PENDING, OrderStatus.CONFIRMED, OrderStatus.CANCELLED},
        OrderStatus.PAYMENT_PENDING: {OrderStatus.CONFIRMED, OrderStatus.PAYMENT_FAILED, OrderStatus.CANCELLED},
        OrderStatus.PAYMENT_FAILED: {OrderStatus.PAYMENT_PENDING, OrderStatus.CANCELLED},
        OrderStatus.CONFIRMED: {OrderStatus.PROCESSING, OrderStatus.CANCELLED},
        OrderStatus.PROCESSING: {OrderStatus.PACKED, OrderStatus.CANCELLED},
        OrderStatus.PACKED: {OrderStatus.READY_FOR_SHIPMENT},
        OrderStatus.READY_FOR_SHIPMENT: {OrderStatus.SHIPPED},
        OrderStatus.SHIPPED: {OrderStatus.OUT_FOR_DELIVERY},
        OrderStatus.OUT_FOR_DELIVERY: {OrderStatus.DELIVERED},
        OrderStatus.DELIVERED: {OrderStatus.RETURN_REQUESTED},
        OrderStatus.RETURN_REQUESTED: {OrderStatus.RETURN_APPROVED, OrderStatus.RETURN_REJECTED},
        OrderStatus.RETURN_APPROVED: {OrderStatus.PICKUP_SCHEDULED},
        OrderStatus.PICKUP_SCHEDULED: {OrderStatus.RETURNED},
        OrderStatus.RETURNED: {OrderStatus.REFUND_INITIATED},
        OrderStatus.REFUND_INITIATED: {OrderStatus.REFUNDED},
    }
    if status == current_status:
        return {"message": "Order status unchanged"}
    if status not in allowed_transitions.get(current_status, set()):
        raise HTTPException(status_code=409, detail=f"Cannot move order from {current_status.value} to {status.value}")

    if status == OrderStatus.CANCELLED:
        await release_order_inventory(order)
    
    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {"status": status.value, "updated_at": datetime.now(timezone.utc)},
            "$push": {"status_history": {
                "status": status.value, "at": datetime.now(timezone.utc),
                "actor_id": user["id"], "source": "admin" if user["role"] == UserRole.ADMIN.value else "seller",
            }},
        }
    )
    
    # Notify customer
    product_names = ", ".join(dict.fromkeys(str(item.get("name") or "Product") for item in order.get("items", [])))
    notification = Notification(
        user_id=order["customer_id"],
        title="Order Update",
        message=f"{product_names or 'Your order'} (#{order_id}) is now {status.value.replace('_', ' ')}",
        type="order_update", link_url="/customer/orders",
    )
    await db.notifications.insert_one(notification.model_dump())
    
    return {"message": "Order status updated"}

# ============== REVIEW ROUTES ==============
@api_router.post("/reviews", response_model=Review)
async def create_review(
    review_data: ReviewCreate,
    user: Dict[str, Any] = Depends(require_role([UserRole.CUSTOMER]))
):
    order = await db.orders.find_one({"id": review_data.order_id, "customer_id": user["id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("status") != OrderStatus.DELIVERED.value:
        raise HTTPException(status_code=409, detail="Reviews can be submitted after delivery")
    purchased_item = next((item for item in order.get("items", []) if
        item.get("product_id") == review_data.product_id and
        (not review_data.variant_id or item.get("variant_id") == review_data.variant_id)), None)
    if not purchased_item:
        raise HTTPException(status_code=403, detail="Only purchased products can be reviewed")
    variant_id = purchased_item.get("variant_id")
    order_item_key = f"{order['id']}:{review_data.product_id}:{variant_id or purchased_item.get('size') or 'base'}"
    if await db.reviews.find_one({"order_item_key": order_item_key}):
        raise HTTPException(status_code=409, detail="This purchased item has already been reviewed")
    now = datetime.now(timezone.utc)
    review = Review(
        customer_id=user["id"],
        customer_name=user["name"],
        product_id=review_data.product_id, order_id=review_data.order_id, variant_id=variant_id,
        order_item_key=order_item_key, rating=review_data.rating, verified_purchase=True,
        comment=review_data.comment, images=review_data.images,
        moderation_history=[{"status": "pending", "at": now, "actor_id": user["id"], "reason": "Submitted by verified purchaser"}],
    )
    try:
        await db.reviews.insert_one(review.model_dump())
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="This purchased item has already been reviewed")
    return review

@api_router.get("/reviews/product/{product_id}", response_model=List[Review])
async def get_product_reviews(product_id: str):
    reviews = await db.reviews.find({
        "product_id": product_id,
        "$or": [{"moderation_status": "approved"}, {"moderation_status": {"$exists": False}}],
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    return reviews

@api_router.get("/storefront/reviews/top")
async def get_storefront_top_reviews(limit: int = Query(default=10, ge=1, le=20)):
    reviews = await db.reviews.find(
        {"moderation_status": "approved", "comment": {"$type": "string", "$ne": ""}}, {"_id": 0},
    ).sort([("rating", -1), ("helpful_count", -1), ("created_at", -1)]).to_list(limit)
    product_ids = list({review["product_id"] for review in reviews})
    products = await db.products.find(
        {"id": {"$in": product_ids}, "is_active": True}, {"_id": 0, "id": 1, "name": 1, "slug": 1, "images": 1},
    ).to_list(len(product_ids) or 1)
    products_by_id = {product["id"]: product for product in products}
    return [{**review, "product": products_by_id.get(review["product_id"])} for review in reviews if products_by_id.get(review["product_id"])]

# ============== NOTIFICATION ROUTES ==============
def notification_channel_configured(channel: str) -> bool:
    if channel == "email":
        return bool(SMTP_HOST and SMTP_FROM_EMAIL)
    if channel == "sms":
        return bool(SMS_WEBHOOK_URL)
    return False


async def materialize_notification_outbox(limit: int = 100) -> int:
    """Convert in-app notifications into idempotent external delivery jobs."""
    materialized = 0
    stale_claim = datetime.now(timezone.utc) - timedelta(minutes=5)
    for _ in range(limit):
        notification = await db.notifications.find_one_and_update(
            {
                "$or": [
                    {"outbox_state": {"$exists": False}},
                    {"outbox_state": "materializing", "outbox_claimed_at": {"$lte": stale_claim}},
                ]
            },
            {"$set": {"outbox_state": "materializing", "outbox_claimed_at": datetime.now(timezone.utc)}},
            sort=[("created_at", 1)], return_document=ReturnDocument.AFTER,
        )
        if not notification:
            break
        user = await db.users.find_one({"id": notification["user_id"]}, {"_id": 0})
        preferences = await db.notification_preferences.find_one(
            {"user_id": notification["user_id"]}, {"_id": 0}
        ) or NotificationPreferences(user_id=notification["user_id"]).model_dump()
        jobs = []
        is_marketing = notification.get("type") == "marketing"
        category_allowed = preferences.get("marketing_enabled", True) if is_marketing else preferences.get("order_updates", True)
        if user and category_allowed and preferences.get("email_enabled", True) and user.get("email"):
            jobs.append(("email", user["email"]))
        if user and category_allowed and preferences.get("sms_enabled", True) and user.get("phone"):
            jobs.append(("sms", user["phone"]))
        for channel, recipient in jobs:
            job = {
                "id": str(uuid.uuid4()), "notification_id": notification["id"],
                "user_id": notification["user_id"], "channel": channel, "recipient": recipient,
                "title": notification["title"], "message": notification["message"],
                "status": "pending" if NOTIFICATION_DELIVERY_ENABLED else "blocked_configuration",
                "attempts": 0, "next_attempt_at": datetime.now(timezone.utc),
                "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc),
            }
            try:
                await db.notification_jobs.insert_one(job)
            except DuplicateKeyError:
                pass
        await db.notifications.update_one(
            {"id": notification["id"], "outbox_state": "materializing"},
            {"$set": {
                "outbox_state": "enqueued" if jobs else "suppressed",
                "outbox_enqueued_at": datetime.now(timezone.utc), "outbox_job_count": len(jobs),
            }},
        )
        materialized += 1
    return materialized


def send_email_job(job: Dict[str, Any]) -> None:
    message = EmailMessage()
    message["From"] = SMTP_FROM_EMAIL
    message["To"] = job["recipient"]
    message["Subject"] = job["title"]
    message.set_content(job["message"])
    context = ssl.create_default_context()
    smtp_class = smtplib.SMTP_SSL if SMTP_USE_SSL else smtplib.SMTP
    with smtp_class(SMTP_HOST, SMTP_PORT, timeout=15, context=context) if SMTP_USE_SSL else smtp_class(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
        smtp.ehlo()
        if SMTP_USE_TLS and not SMTP_USE_SSL:
            smtp.starttls(context=context)
        if SMTP_USERNAME:
            smtp.login(SMTP_USERNAME, SMTP_PASSWORD or "")
        smtp.send_message(message)


def send_sms_job(job: Dict[str, Any]) -> None:
    headers = {"Content-Type": "application/json"}
    if SMS_WEBHOOK_TOKEN:
        headers["Authorization"] = f"Bearer {SMS_WEBHOOK_TOKEN}"
    response = requests.post(
        SMS_WEBHOOK_URL, headers=headers,
        json={"to": job["recipient"], "message": f"{job['title']}: {job['message']}"}, timeout=15,
    )
    response.raise_for_status()


async def deliver_notification_jobs(limit: int = 50) -> Dict[str, int]:
    summary = {"delivered": 0, "retried": 0, "dead": 0, "blocked": 0}
    if not NOTIFICATION_DELIVERY_ENABLED:
        return summary
    for _ in range(limit):
        now = datetime.now(timezone.utc)
        job = await db.notification_jobs.find_one_and_update(
            {"status": "pending", "next_attempt_at": {"$lte": now}, "attempts": {"$lt": NOTIFICATION_MAX_ATTEMPTS}},
            {"$set": {"status": "processing", "claimed_at": now, "updated_at": now}},
            sort=[("next_attempt_at", 1)], return_document=ReturnDocument.AFTER,
        )
        if not job:
            break
        if not notification_channel_configured(job["channel"]):
            await db.notification_jobs.update_one(
                {"id": job["id"], "status": "processing"},
                {"$set": {"status": "blocked_configuration", "last_error_code": "provider_not_configured", "updated_at": now}},
            )
            summary["blocked"] += 1
            continue
        try:
            if job["channel"] == "email":
                await asyncio.to_thread(send_email_job, job)
            elif job["channel"] == "sms":
                await asyncio.to_thread(send_sms_job, job)
            else:
                raise ValueError("Unsupported notification channel")
            await db.notification_jobs.update_one(
                {"id": job["id"], "status": "processing"},
                {"$set": {"status": "delivered", "delivered_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}},
            )
            summary["delivered"] += 1
        except Exception as error:
            attempts = int(job.get("attempts", 0)) + 1
            dead = attempts >= NOTIFICATION_MAX_ATTEMPTS
            delay = min(60 * (2 ** attempts), 3600)
            await db.notification_jobs.update_one(
                {"id": job["id"], "status": "processing"},
                {"$set": {
                    "status": "dead" if dead else "pending", "attempts": attempts,
                    "next_attempt_at": datetime.now(timezone.utc) + timedelta(seconds=delay),
                    "last_error_code": type(error).__name__, "updated_at": datetime.now(timezone.utc),
                }},
            )
            summary["dead" if dead else "retried"] += 1
    return summary


@api_router.get("/notifications/my", response_model=List[Notification])
async def get_my_notifications(user: Dict[str, Any] = Depends(get_current_user)):
    notifications = await db.notifications.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    await db.notifications.update_one(
        {"id": notification_id, "user_id": user["id"]},
        {"$set": {"is_read": True}}
    )
    return {"message": "Notification marked as read"}

@api_router.post("/admin/notifications/broadcast")
async def broadcast_notification(
    notification_data: NotificationCreate,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Send notifications to specific users, roles, or all users"""
    recipients = []
    
    if notification_data.user_ids:
        # Targeted notification to specific users
        recipients = notification_data.user_ids
    elif notification_data.target_roles:
        # Send to users with specific roles
        users = await db.users.find(
            {"role": {"$in": notification_data.target_roles}}, 
            {"_id": 0, "id": 1}
        ).to_list(10000)
        recipients = [u["id"] for u in users]
    else:
        # Broadcast to all users
        users = await db.users.find({}, {"_id": 0, "id": 1}).to_list(10000)
        recipients = [u["id"] for u in users]
    
    # Create notifications for all recipients
    notifications_to_insert = []
    for user_id in recipients:
        notification = Notification(
            user_id=user_id,
            title=notification_data.title,
            message=notification_data.message,
            type=notification_data.type,
            link_url=notification_data.link_url
        )
        notifications_to_insert.append(notification.model_dump())
    
    if notifications_to_insert:
        await db.notifications.insert_many(notifications_to_insert)
    
    return {"message": f"Notifications sent to {len(recipients)} users"}


@api_router.get("/admin/notifications/outbox")
async def notification_outbox_status(user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))):
    counts = {}
    for status_value in ["pending", "processing", "delivered", "blocked_configuration", "dead"]:
        counts[status_value] = await db.notification_jobs.count_documents({"status": status_value})
    return {
        "delivery_enabled": NOTIFICATION_DELIVERY_ENABLED,
        "email_configured": notification_channel_configured("email"),
        "sms_configured": notification_channel_configured("sms"),
        "counts": counts,
    }


@api_router.post("/admin/notifications/outbox/retry-dead")
async def retry_dead_notification_jobs(user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))):
    retry_filter: Dict[str, Any] = {"status": "dead"}
    configured_channels = [channel for channel in ["email", "sms"] if notification_channel_configured(channel)]
    if NOTIFICATION_DELIVERY_ENABLED and configured_channels:
        retry_filter = {"$or": [
            {"status": "dead"},
            {"status": "blocked_configuration", "channel": {"$in": configured_channels}},
        ]}
    result = await db.notification_jobs.update_many(
        retry_filter,
        {"$set": {"status": "pending", "attempts": 0, "next_attempt_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}},
    )
    return {"queued": result.modified_count}


@api_router.post("/admin/notifications/outbox/run")
async def run_notification_outbox_now(user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))):
    materialized = await materialize_notification_outbox(limit=1000)
    delivery = await deliver_notification_jobs(limit=1000)
    return {"materialized": materialized, "delivery": delivery}

# ============== SUPPORT ROUTES ==============
@api_router.post("/support/tickets", response_model=SupportTicket)
async def create_ticket(
    ticket_data: TicketCreate,
    user: Dict[str, Any] = Depends(get_current_user)
):
    ticket = SupportTicket(
        user_id=user["id"],
        **ticket_data.model_dump()
    )
    await db.support_tickets.insert_one(ticket.model_dump())
    return ticket

@api_router.get("/support/tickets/my", response_model=List[SupportTicket])
async def get_my_tickets(user: Dict[str, Any] = Depends(get_current_user)):
    tickets = await db.support_tickets.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return tickets

# ============== ANALYTICS ROUTES ==============
@api_router.get("/analytics/seller")
async def get_seller_analytics(
    period: str = "monthly",  # daily, weekly, monthly, yearly
    user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))
):
    seller = await db.sellers.find_one({"user_id": user["id"]})
    
    # Get orders for this seller
    orders = await db.orders.find({"items.seller_id": seller["id"]}).to_list(10000)
    
    # Calculate analytics
    total_revenue = sum(
        sum(item["price"] * item["quantity"] for item in order["items"] if item["seller_id"] == seller["id"])
        for order in orders
    )
    total_orders = len(orders)
    
    # Get product stats
    products = await db.products.find({"seller_id": seller["id"]}).to_list(1000)
    active_products = len([p for p in products if p.get("is_active", True)])
    
    return {
        "period": period,
        "total_revenue": total_revenue,
        "total_orders": total_orders,
        "active_products": active_products,
        "orders": orders
    }

@api_router.get("/analytics/admin")
async def get_admin_analytics(user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))):
    # Platform KPIs
    total_users = await db.users.count_documents({})
    total_sellers = await db.sellers.count_documents({})
    pending_sellers = await db.sellers.count_documents({"status": SellerStatus.PENDING.value})
    total_products = await db.products.count_documents({"is_active": True})
    total_orders = await db.orders.count_documents({})
    
    # Revenue
    orders = await db.orders.find({}).to_list(10000)
    total_revenue = sum(order["total_amount"] for order in orders)
    
    # Platform fee collected
    platform_fees = await db.platform_fees.find({}).to_list(10000)
    total_platform_fee = sum(fee.get("fee_amount", 0) for fee in platform_fees)
    now = datetime.now(timezone.utc)
    monthly_performance = []
    for offset in range(5, -1, -1):
        month_index = now.month - offset - 1
        year = now.year + month_index // 12
        month = month_index % 12 + 1
        month_orders = [order for order in orders if isinstance(order.get("created_at"), datetime) and order["created_at"].year == year and order["created_at"].month == month]
        monthly_performance.append({"month": datetime(year, month, 1).strftime("%b"), "orders": len(month_orders), "revenue": round(sum(float(order.get("total_amount", 0)) for order in month_orders), 2)})
    status_counts: Dict[str, int] = defaultdict(int)
    for order in orders:
        status_counts[str(order.get("status", "unknown"))] += 1
    
    return {
        "total_users": total_users,
        "total_sellers": total_sellers,
        "pending_sellers": pending_sellers,
        "total_products": total_products,
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "total_platform_fee": total_platform_fee
        ,"monthly_performance": monthly_performance
        ,"order_statuses": [{"status": key.replace("_", " ").title(), "count": value} for key, value in status_counts.items()]
    }

@api_router.get("/analytics/admin/seller-revenue")
async def get_seller_wise_revenue(user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))):
    """Get seller-wise revenue breakdown for admin analytics"""
    # Get all sellers
    sellers = await db.sellers.find({}, {"_id": 0}).to_list(1000)
    
    seller_revenue = []
    for seller in sellers:
        # Get user info for seller name
        seller_user = await db.users.find_one({"id": seller["user_id"]}, {"_id": 0})
        
        # Get platform fees for this seller
        fees = await db.platform_fees.find({"seller_id": seller["id"]}, {"_id": 0}).to_list(1000)
        
        total_orders = len(fees)
        gross_revenue = sum(fee.get("order_amount", 0) for fee in fees)
        platform_fee = sum(fee.get("fee_amount", 0) for fee in fees)
        net_revenue = sum(fee.get("seller_payout", 0) for fee in fees)
        
        # Get payouts
        payouts = await db.seller_payouts.find({"seller_id": seller["id"]}, {"_id": 0}).to_list(1000)
        total_paid = sum(p.get("net_payout", 0) for p in payouts if p.get("status") == "paid")
        pending_payout = net_revenue - total_paid
        
        seller_revenue.append({
            "seller_id": seller["id"],
            "seller_name": seller_user["name"] if seller_user else "Unknown",
            "business_name": seller.get("business_name", seller_user["name"] if seller_user else "Unknown"),
            "email": seller_user["email"] if seller_user else "",
            "total_orders": total_orders,
            "gross_revenue": round(gross_revenue, 2),
            "platform_fee": round(platform_fee, 2),
            "net_revenue": round(net_revenue, 2),
            "total_paid": round(total_paid, 2),
            "pending_payout": round(pending_payout, 2),
            "status": seller.get("status", "pending")
        })
    
    # Sort by gross revenue descending
    seller_revenue.sort(key=lambda x: x["gross_revenue"], reverse=True)
    
    return {
        "sellers": seller_revenue,
        "summary": {
            "total_gross_revenue": sum(s["gross_revenue"] for s in seller_revenue),
            "total_platform_fee": sum(s["platform_fee"] for s in seller_revenue),
            "total_seller_payouts": sum(s["total_paid"] for s in seller_revenue),
            "total_pending": sum(s["pending_payout"] for s in seller_revenue)
        }
    }

# ============== CATEGORIES ==============
@api_router.get("/categories")
async def get_categories():
    products = await db.products.find({"is_active": True}, {"_id": 0, "category": 1}).to_list(10000)
    categories = list(set(p["category"] for p in products))
    return {"categories": categories}

# ============== ADMIN USER MANAGEMENT ==============
@api_router.get("/admin/users")
async def get_all_users(
    role: Optional[str] = None,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Get all users for admin - optional filter by role"""
    query = {}
    if role:
        query["role"] = role
    
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(10000)
    return users


@api_router.get("/admin/customers")
async def get_admin_customers(
    q: Optional[str] = Query(default=None, max_length=100),
    status: Optional[Literal["active", "disabled", "blocked"]] = None,
    city: Optional[str] = Query(default=None, max_length=100),
    min_orders: Optional[int] = Query(default=None, ge=0),
    min_spent: Optional[float] = Query(default=None, ge=0),
    page: int = Query(default=1, ge=1), page_size: int = Query(default=30, ge=1, le=100),
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN])),
):
    query: Dict[str, Any] = {"role": UserRole.CUSTOMER.value}
    if status:
        query["is_active"] = status == "active"
        if status != "active": query["account_status"] = status
    if q:
        pattern = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"id": pattern}, {"name": pattern}, {"email": pattern}, {"phone": pattern}]
    total = await db.users.count_documents(query)
    customers = await db.users.find(query, {"_id": 0, "password_hash": 0, "permissions": 0}).sort("created_at", -1).skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    customer_ids = [customer["id"] for customer in customers]
    orders = await db.orders.find({"customer_id": {"$in": customer_ids}}, {"_id": 0, "customer_id": 1, "status": 1, "total_amount": 1, "created_at": 1}).to_list(100000)
    addresses = await db.addresses.find({"user_id": {"$in": customer_ids}}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    address_by_customer = {}
    for address in addresses:
        address_by_customer.setdefault(address.get("user_id"), address)
    rows = []
    for customer in customers:
        customer_orders = [order for order in orders if order.get("customer_id") == customer["id"]]
        cancelled = sum(order.get("status") == OrderStatus.CANCELLED.value for order in customer_orders)
        delivered = sum(order.get("status") == OrderStatus.DELIVERED.value for order in customer_orders)
        spent = round(sum(float(order.get("total_amount", 0)) for order in customer_orders if order.get("status") not in {OrderStatus.CANCELLED.value, OrderStatus.PAYMENT_FAILED.value}), 2)
        address = address_by_customer.get(customer["id"], {})
        row = {**customer, "account_status": customer.get("account_status", "active" if customer.get("is_active", True) else "disabled"), "promotional_credit": float(customer.get("promotional_credit", 0)), "location": {"city": address.get("city"), "state": address.get("state"), "pincode": address.get("pincode")}, "order_stats": {"total": len(customer_orders), "cancelled": cancelled, "delivered": delivered, "active": len(customer_orders) - cancelled - delivered, "total_spent": spent, "last_order_at": max((order.get("created_at") for order in customer_orders), default=None)}}
        if city and city.lower() not in str(row["location"].get("city") or "").lower(): continue
        if min_orders is not None and len(customer_orders) < min_orders: continue
        if min_spent is not None and spent < min_spent: continue
        rows.append(row)
    return {"items": rows, "total": total, "page": page, "page_size": page_size, "pages": max(1, (total + page_size - 1) // page_size)}

@api_router.put("/admin/customers/{customer_id}/account")
async def update_customer_account(customer_id: str, payload: CustomerAccountAction, user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))):
    if not await db.users.find_one({"id": customer_id, "role": UserRole.CUSTOMER.value}): raise HTTPException(status_code=404, detail="Customer not found")
    until = datetime.now(timezone.utc) + timedelta(days=payload.duration_days) if payload.status != "active" and payload.duration_days else None
    updates = {"account_status": payload.status, "is_active": payload.status == "active", "restricted_until": until, "restriction_reason": payload.reason}
    await db.users.update_one({"id": customer_id}, {"$set": updates})
    if payload.status != "active": await db.auth_sessions.update_many({"user_id": customer_id, "revoked_at": None}, {"$set": {"revoked_at": datetime.now(timezone.utc), "reason": payload.status}})
    await db.audit_logs.insert_one({"id": str(uuid.uuid4()), "actor_id": user["id"], "action": "customer_account_status_changed", "resource_type": "user", "resource_id": customer_id, "changes": updates, "at": datetime.now(timezone.utc)})
    return {"message": f"Customer account marked {payload.status}", **updates}

@api_router.post("/admin/customers/{customer_id}/credits")
async def grant_customer_credit(customer_id: str, payload: CustomerCreditGrant, user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))):
    if not await db.users.find_one({"id": customer_id, "role": UserRole.CUSTOMER.value}): raise HTTPException(status_code=404, detail="Customer not found")
    if payload.product_id and not await db.products.find_one({"id": payload.product_id}): raise HTTPException(status_code=404, detail="Product not found")
    grant = {"id": str(uuid.uuid4()), "customer_id": customer_id, **payload.model_dump(), "status": "available", "created_by": user["id"], "created_at": datetime.now(timezone.utc)}
    await db.customer_credits.insert_one(grant)
    grant.pop("_id", None)
    await db.users.update_one({"id": customer_id}, {"$inc": {"promotional_credit": payload.amount}})
    await db.audit_logs.insert_one({"id": str(uuid.uuid4()), "actor_id": user["id"], "action": "customer_credit_granted", "resource_type": "user", "resource_id": customer_id, "changes": {"amount": payload.amount, "product_id": payload.product_id, "reason": payload.reason}, "at": datetime.now(timezone.utc)})
    return {**grant, "message": "Promotional credit added"}

# ============== COUPON ROUTES ==============
@api_router.post("/admin/coupons", response_model=Coupon)
async def create_coupon(
    coupon_data: CouponCreate,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    # Check if coupon code already exists
    existing = await db.coupons.find_one({"code": coupon_data.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Coupon code already exists")
    
    coupon_payload = coupon_data.model_dump()
    coupon_payload["code"] = coupon_data.code.upper()
    coupon = Coupon(**coupon_payload)
    
    await db.coupons.insert_one(coupon.model_dump())
    return coupon

@api_router.get("/coupons/validate/{code}")
async def validate_coupon(
    code: str, order_amount: float = Query(ge=0),
    user: Dict[str, Any] = Depends(require_role([UserRole.CUSTOMER])),
):
    coupon, discount = await resolve_checkout_coupon(code, order_amount, user["id"])
    
    if order_amount < coupon["min_order_amount"]:
        raise HTTPException(status_code=400, detail=f"Minimum order amount is ₹{coupon['min_order_amount']}")
    
    return {
        "valid": True,
        "discount": discount,
        "code": coupon["code"],
        "discount_type": coupon["discount_type"]
    }

@api_router.get("/coupons/active")
async def get_active_coupons():
    now = datetime.now(timezone.utc)
    coupons = await db.coupons.find({"is_active": True, "audience_type": {"$in": [None, "all", "first_order"]}}, {"_id": 0, "eligible_user_ids": 0}).to_list(500)
    return [
        coupon for coupon in coupons
        if _coupon_datetime(coupon["valid_from"]) <= now <= _coupon_datetime(coupon["valid_until"])
        and (not coupon.get("usage_limit") or int(coupon.get("used_count", 0)) < int(coupon["usage_limit"]))
    ]

@api_router.get("/coupons/mine")
async def get_my_eligible_coupons(user: Dict[str, Any] = Depends(require_role([UserRole.CUSTOMER]))):
    now = datetime.now(timezone.utc)
    completed = await db.orders.count_documents({"customer_id": user["id"], "status": OrderStatus.DELIVERED.value})
    coupons = await db.coupons.find({"is_active": True}, {"_id": 0}).to_list(500)
    eligible = []
    for coupon in coupons:
        if not (_coupon_datetime(coupon["valid_from"]) <= now <= _coupon_datetime(coupon["valid_until"])): continue
        if coupon.get("usage_limit") and int(coupon.get("used_count", 0)) >= int(coupon["usage_limit"]): continue
        audience = coupon.get("audience_type", "all")
        if audience == "first_order" and completed > 0: continue
        if audience == "completed_orders" and completed < int(coupon.get("min_completed_orders") or 1): continue
        if audience == "specific_users" and user["id"] not in coupon.get("eligible_user_ids", []): continue
        eligible.append({key: value for key, value in coupon.items() if key != "eligible_user_ids"})
    return eligible

# ============== TICKER MESSAGE ROUTES ==============
@api_router.post("/admin/ticker", response_model=TickerMessage)
async def create_ticker_message(
    message: str,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    # Deactivate all previous tickers
    await db.ticker_messages.update_many({}, {"$set": {"is_active": False}})
    
    ticker = TickerMessage(
        message=message,
        created_by=user["id"]
    )
    
    await db.ticker_messages.insert_one(ticker.model_dump())
    return ticker

@api_router.get("/ticker/active")
async def get_active_ticker():
    ticker = await db.ticker_messages.find_one(
        {"is_active": True},
        {"_id": 0},
        sort=[("priority", -1), ("created_at", -1)]
    )
    
    if not ticker:
        return {"message": "🔥 SALE — Only 24 hours left • Grab the best deals • Free shipping on selected items"}
    
    return ticker

# ============== NOTIFICATION PREFERENCES ==============
@api_router.get("/notifications/preferences")
async def get_notification_preferences(user: Dict[str, Any] = Depends(get_current_user)):
    prefs = await db.notification_preferences.find_one({"user_id": user["id"]}, {"_id": 0})
    
    if not prefs:
        # Create default preferences
        prefs = NotificationPreferences(user_id=user["id"]).model_dump()
        await db.notification_preferences.insert_one(prefs)
    
    return prefs

@api_router.put("/notifications/preferences")
async def update_notification_preferences(
    preferences: Dict[str, bool],
    user: Dict[str, Any] = Depends(get_current_user)
):
    await db.notification_preferences.update_one(
        {"user_id": user["id"]},
        {"$set": preferences},
        upsert=True
    )
    return {"message": "Preferences updated"}

# ============== PRODUCT VIEW TRACKING ==============
@api_router.post("/products/{product_id}/view")
async def track_product_view(product_id: str, session_id: Optional[str] = None, user_id: Optional[str] = None):
    view = ProductView(
        product_id=product_id,
        user_id=user_id,
        session_id=session_id
    )
    await db.product_views.insert_one(view.model_dump())
    
    # Update view count on product
    await db.products.update_one(
        {"id": product_id},
        {"$inc": {"view_count": 1}}
    )
    return {"message": "View tracked"}

# ============== SEARCH API ==============
@api_router.get("/search")
async def search_products(q: str, category: Optional[str] = None, min_price: Optional[float] = None, 
                          max_price: Optional[float] = None, sort: Optional[str] = None, limit: int = 50):
    query = {"is_active": True}
    
    # Text search
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"category": {"$regex": q, "$options": "i"}}
        ]
    
    # Category filter
    if category:
        query["category"] = {"$regex": category, "$options": "i"}
    
    # Price range
    if min_price is not None:
        query["price"] = {"$gte": min_price}
    if max_price is not None:
        if "price" in query:
            query["price"]["$lte"] = max_price
        else:
            query["price"] = {"$lte": max_price}
    
    # Sort options
    sort_field = [("created_at", -1)]  # Default: newest first
    if sort == "price_low":
        sort_field = [("price", 1)]
    elif sort == "price_high":
        sort_field = [("price", -1)]
    elif sort == "name":
        sort_field = [("name", 1)]
    elif sort == "popular":
        sort_field = [("view_count", -1)]
    
    products = await db.products.find(query, {"_id": 0}).sort(sort_field).limit(limit).to_list(limit)
    return [public_product(product) for product in products]

@api_router.get("/search/suggestions")
async def get_search_suggestions(q: str, limit: int = 10):
    if not q or len(q) < 2:
        return {"suggestions": [], "products": []}
    
    # Get product name suggestions
    products = await db.products.find(
        {
            "is_active": True,
            "name": {"$regex": q, "$options": "i"}
        },
        {"_id": 0, "name": 1, "id": 1, "category": 1, "price": 1, "images": 1}
    ).limit(limit).to_list(limit)
    
    # Get category suggestions
    categories = await db.products.distinct("category", {
        "is_active": True,
        "category": {"$regex": q, "$options": "i"}
    })
    
    return {
        "suggestions": categories[:5],
        "products": products
    }

# ============== ADDRESS MANAGEMENT ==============
@api_router.post("/addresses", response_model=Address)
async def create_address(
    address_data: AddressCreate,
    user: Dict[str, Any] = Depends(get_current_user)
):
    # If this is the first address or marked as default, set others as non-default
    if address_data.is_default:
        await db.addresses.update_many(
            {"user_id": user["id"]},
            {"$set": {"is_default": False}}
        )
    
    # Check if this is first address
    existing_count = await db.addresses.count_documents({"user_id": user["id"]})
    
    address_dict = address_data.model_dump()
    address_dict["user_id"] = user["id"]
    address_dict["is_default"] = address_data.is_default or existing_count == 0
    
    address = Address(**address_dict)
    
    await db.addresses.insert_one(address.model_dump())
    return address

@api_router.get("/addresses", response_model=List[Address])
async def get_addresses(user: Dict[str, Any] = Depends(get_current_user)):
    addresses = await db.addresses.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("is_default", -1).to_list(100)
    return addresses

@api_router.put("/addresses/{address_id}", response_model=Address)
async def update_address(
    address_id: str,
    address_data: AddressCreate,
    user: Dict[str, Any] = Depends(get_current_user)
):
    address = await db.addresses.find_one({"id": address_id, "user_id": user["id"]})
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")
    
    # If setting as default, unset others
    if address_data.is_default:
        await db.addresses.update_many(
            {"user_id": user["id"], "id": {"$ne": address_id}},
            {"$set": {"is_default": False}}
        )
    
    await db.addresses.update_one(
        {"id": address_id},
        {"$set": address_data.model_dump()}
    )
    
    updated = await db.addresses.find_one({"id": address_id}, {"_id": 0})
    return updated

@api_router.delete("/addresses/{address_id}")
async def delete_address(
    address_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    address = await db.addresses.find_one({"id": address_id, "user_id": user["id"]})
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")
    
    await db.addresses.delete_one({"id": address_id})
    
    # If deleted address was default, set another as default
    if address.get("is_default"):
        first_address = await db.addresses.find_one({"user_id": user["id"]})
        if first_address:
            await db.addresses.update_one(
                {"id": first_address["id"]},
                {"$set": {"is_default": True}}
            )
    
    return {"message": "Address deleted"}

@api_router.put("/addresses/{address_id}/default")
async def set_default_address(
    address_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    address = await db.addresses.find_one({"id": address_id, "user_id": user["id"]})
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")
    
    # Unset all others
    await db.addresses.update_many(
        {"user_id": user["id"]},
        {"$set": {"is_default": False}}
    )
    
    # Set this one as default
    await db.addresses.update_one(
        {"id": address_id},
        {"$set": {"is_default": True}}
    )
    
    return {"message": "Default address updated"}

# ============== PINCODE LOOKUP ==============
@api_router.get("/location/reverse")
async def reverse_current_location(
    latitude: float = Query(ge=-90, le=90), longitude: float = Query(ge=-180, le=180),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Resolve browser coordinates to editable address fields via an env-configurable provider."""
    url = REVERSE_GEOCODING_URL.format(latitude=latitude, longitude=longitude)
    try:
        response = await asyncio.to_thread(requests.get, url, timeout=8, headers={"User-Agent": "Perfurm/1.0"})
        response.raise_for_status(); data = response.json()
    except Exception as exc:
        logger.warning("Reverse geocoding failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not fetch the current address; enter it manually")
    locality = data.get("locality") or data.get("city") or data.get("principalSubdivision") or ""
    return {
        "city": locality,
        "state": data.get("principalSubdivision") or data.get("state") or "",
        "pincode": str(data.get("postcode") or data.get("postalCode") or "").replace(" ", "")[:6],
        "address_line2": data.get("localityInfo", {}).get("administrative", [{}])[-1].get("name", "") if data.get("localityInfo", {}).get("administrative") else locality,
        "latitude": latitude, "longitude": longitude,
    }

class PincodeRule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pincode: str = Field(pattern=r"^\d{6}$")
    city: str
    state: str
    delivery_days: int = Field(ge=1, le=30)
    cod_available: bool = True
    delivery_charge: float = Field(default=0, ge=0)
    is_active: bool = True
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSettingsUpdate(BaseModel):
    theme: Optional[Literal["light", "dark", "system"]] = None
    language: Optional[Literal["en", "hi", "ta", "te"]] = None
    currency: Optional[Literal["INR", "USD", "EUR"]] = None
    notifications_email: Optional[bool] = None
    notifications_sms: Optional[bool] = None
    notifications_push: Optional[bool] = None
    marketing_emails: Optional[bool] = None
    order_updates: Optional[bool] = None
    offers_promotions: Optional[bool] = None
    wishlist_alerts: Optional[bool] = None
    restock_alerts: Optional[bool] = None
    price_drop_alerts: Optional[bool] = None
    personalized_recommendations: Optional[bool] = None
    analytics_consent: Optional[bool] = None
    two_factor_enabled: Optional[bool] = None

class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=10, max_length=128)

    @model_validator(mode="after")
    def validate_password_change(self):
        if not re.search(r"[A-Z]", self.new_password) or not re.search(r"[a-z]", self.new_password) or not re.search(r"\d", self.new_password) or not re.search(r"[^A-Za-z0-9]", self.new_password):
            raise ValueError("New password must include uppercase, lowercase, number and symbol")
        if self.current_password == self.new_password:
            raise ValueError("New password must be different")
        return self

class AccountDeletionRequestCreate(BaseModel):
    password: str = Field(min_length=1, max_length=128)
    reason: Optional[str] = Field(default=None, max_length=500)

class AccountDeletionDecision(BaseModel):
    status: Literal["approved", "rejected"]
    notes: str = Field(min_length=3, max_length=1000)

class PincodeRuleUpdate(BaseModel):
    city: str
    state: str
    delivery_days: int = Field(ge=1, le=30)
    cod_available: bool = True
    delivery_charge: float = Field(default=0, ge=0)
    is_active: bool = True

@api_router.get("/pincode/{pincode}")
async def get_pincode_details(pincode: str):
    if not re.fullmatch(r"\d{6}", pincode):
        raise HTTPException(status_code=400, detail="Invalid pincode format")
    rule = await db.pincode_rules.find_one({"pincode": pincode, "is_active": True}, {"_id": 0})
    if not rule:
        return {"pincode": pincode, "delivery_available": False, "cod_available": False}
    return {
        "pincode": pincode,
        "city": rule["city"],
        "state": rule["state"],
        "delivery_available": True,
        "estimated_delivery_days": rule["delivery_days"],
        "cod_available": rule["cod_available"],
        "delivery_charge": rule.get("delivery_charge", 0),
    }

@api_router.get("/admin/pincode-rules")
async def list_pincode_rules(
    q: Optional[str] = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN])),
):
    query: Dict[str, Any] = {}
    if q:
        pattern = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"pincode": pattern}, {"city": pattern}, {"state": pattern}]
    total = await db.pincode_rules.count_documents(query)
    items = await db.pincode_rules.find(query, {"_id": 0}).sort("pincode", 1).skip(
        (page - 1) * page_size
    ).limit(page_size).to_list(page_size)
    return {
        "items": items, "total": total, "page": page, "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size),
    }

@api_router.put("/admin/pincode-rules/{pincode}", response_model=PincodeRule)
async def upsert_pincode_rule(
    pincode: str, payload: PincodeRuleUpdate,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN])),
):
    if not re.fullmatch(r"\d{6}", pincode):
        raise HTTPException(status_code=400, detail="Invalid pincode format")
    existing = await db.pincode_rules.find_one({"pincode": pincode})
    rule_id = existing["id"] if existing else str(uuid.uuid4())
    document = {"id": rule_id, "pincode": pincode, **payload.model_dump(), "updated_at": datetime.now(timezone.utc)}
    await db.pincode_rules.update_one({"pincode": pincode}, {"$set": document}, upsert=True)
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()), "actor_id": user["id"], "action": "pincode_rule_upsert",
        "resource_type": "pincode_rule", "resource_id": pincode, "at": datetime.now(timezone.utc),
    })
    return document

@api_router.delete("/admin/pincode-rules/{pincode}")
async def disable_pincode_rule(pincode: str, user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))):
    result = await db.pincode_rules.update_one(
        {"pincode": pincode}, {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}}
    )
    if result.matched_count != 1:
        raise HTTPException(status_code=404, detail="Pincode rule not found")
    return {"message": "Pincode rule disabled"}

# ============== USER SETTINGS ==============
@api_router.get("/settings")
async def get_user_settings(user: Dict[str, Any] = Depends(get_current_user)):
    settings = await db.user_settings.find_one({"user_id": user["id"]}, {"_id": 0})
    
    if not settings:
        # Create default settings
        settings = UserSettings(user_id=user["id"]).model_dump()
        await db.user_settings.insert_one(settings)
    
    return settings

@api_router.put("/settings")
async def update_user_settings(
    settings_data: UserSettingsUpdate,
    user: Dict[str, Any] = Depends(get_current_user)
):
    updates = settings_data.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No settings supplied")
    updates["updated_at"] = datetime.now(timezone.utc)
    
    await db.user_settings.update_one(
        {"user_id": user["id"]},
        {"$set": updates},
        upsert=True
    )
    notification_updates = {
        target: updates[source]
        for source, target in {
            "notifications_email": "email_enabled", "notifications_sms": "sms_enabled",
            "notifications_push": "push_enabled", "marketing_emails": "marketing_enabled",
            "order_updates": "order_updates", "offers_promotions": "offers_promotions",
        }.items() if source in updates
    }
    if notification_updates:
        await db.notification_preferences.update_one(
            {"user_id": user["id"]}, {"$set": {"user_id": user["id"], **notification_updates}}, upsert=True,
        )
    
    return await db.user_settings.find_one({"user_id": user["id"]}, {"_id": 0})

# ============== USER PROFILE ==============
@api_router.get("/profile")
async def get_user_profile(user: Dict[str, Any] = Depends(get_current_user)):
    # Get full user info
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    
    # Get additional stats
    orders_count = await db.orders.count_documents({"customer_id": user["id"]})
    reviews_count = await db.reviews.count_documents({"customer_id": user["id"]})
    addresses_count = await db.addresses.count_documents({"user_id": user["id"]})
    
    return {
        **user_data,
        "stats": {
            "orders_count": orders_count,
            "reviews_count": reviews_count,
            "addresses_count": addresses_count
        }
    }

@api_router.put("/profile")
async def update_user_profile(
    profile_data: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user)
):
    # Only allow updating certain fields
    allowed_fields = ["name", "phone"]
    update_data = {k: v for k, v in profile_data.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": update_data}
    )
    
    updated_user = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return updated_user

@api_router.post("/profile/change-password")
async def change_password(payload: PasswordChange, response: Response, user: Dict[str, Any] = Depends(get_current_user)):
    account = await db.users.find_one({"id": user["id"]})
    if not account or not verify_password(payload.current_password, account["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    now = datetime.now(timezone.utc)
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(payload.new_password), "password_changed_at": now}})
    await db.auth_sessions.update_many({"user_id": user["id"], "revoked_at": None}, {"$set": {"revoked_at": now, "revocation_reason": "password_changed"}})
    await db.audit_logs.insert_one({"id": str(uuid.uuid4()), "actor_id": user["id"], "action": "account.password_changed", "entity_type": "user", "entity_id": user["id"], "created_at": now})
    clear_refresh_cookie(response)
    return {"message": "Password changed. Sign in again on your devices."}

@api_router.get("/profile/data-export")
async def export_customer_data(user: Dict[str, Any] = Depends(require_role([UserRole.CUSTOMER]))):
    profile = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0, "permissions": 0, "admin_role": 0})
    orders = await db.orders.find({"customer_id": user["id"]}, {"_id": 0, "internal_notes": 0, "admin_notes": 0}).sort("created_at", -1).to_list(10000)
    for order in orders:
        order.pop("payment_signature", None)
    export_document = {
        "exported_at": datetime.now(timezone.utc), "profile": profile,
        "settings": await db.user_settings.find_one({"user_id": user["id"]}, {"_id": 0}),
        "addresses": await db.addresses.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000),
        "orders": orders,
        "reviews": await db.reviews.find({"customer_id": user["id"]}, {"_id": 0, "moderation_history": 0}).to_list(10000),
        "support_tickets": await db.support_tickets.find({"user_id": user["id"]}, {"_id": 0, "internal_notes": 0}).to_list(10000),
        "return_requests": await db.return_requests.find({"customer_id": user["id"]}, {"_id": 0}).to_list(10000),
    }
    def portable(value):
        if isinstance(value, ObjectId): return str(value)
        if isinstance(value, dict): return {key: portable(item) for key, item in value.items()}
        if isinstance(value, list): return [portable(item) for item in value]
        return value
    return portable(export_document)

@api_router.post("/profile/deletion-request")
async def request_account_deletion(payload: AccountDeletionRequestCreate, user: Dict[str, Any] = Depends(require_role([UserRole.CUSTOMER]))):
    account = await db.users.find_one({"id": user["id"]})
    if not account or not verify_password(payload.password, account["password_hash"]):
        raise HTTPException(status_code=400, detail="Password is incorrect")
    active_statuses = [status.value for status in OrderStatus if status not in {OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.RETURNED, OrderStatus.REFUNDED}]
    if await db.orders.find_one({"customer_id": user["id"], "status": {"$in": active_statuses}}):
        raise HTTPException(status_code=409, detail="Account deletion cannot start while an order is active")
    if await db.account_deletion_requests.find_one({"user_id": user["id"], "status": "pending"}):
        raise HTTPException(status_code=409, detail="An account deletion request is already pending")
    now = datetime.now(timezone.utc)
    request_document = {"id": str(uuid.uuid4()), "user_id": user["id"], "email": user["email"], "reason": payload.reason, "status": "pending", "requested_at": now}
    await db.account_deletion_requests.insert_one(request_document)
    await db.audit_logs.insert_one({"id": str(uuid.uuid4()), "actor_id": user["id"], "action": "account.deletion_requested", "entity_type": "user", "entity_id": user["id"], "created_at": now})
    return {key: request_document[key] for key in ("id", "user_id", "reason", "status", "requested_at")}

@api_router.get("/admin/privacy/deletion-requests")
async def list_account_deletion_requests(
    status: Optional[Literal["pending", "approved", "rejected", "completed"]] = None,
    page: int = Query(default=1, ge=1), page_size: int = Query(default=30, ge=1, le=100),
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN])),
):
    query: Dict[str, Any] = {"status": status} if status else {}
    total = await db.account_deletion_requests.count_documents(query)
    items = await db.account_deletion_requests.find(query, {"_id": 0}).sort("requested_at", -1).skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size, "pages": max(1, (total + page_size - 1) // page_size)}

@api_router.patch("/admin/privacy/deletion-requests/{request_id}")
async def decide_account_deletion(
    request_id: str, payload: AccountDeletionDecision,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN])),
):
    deletion = await db.account_deletion_requests.find_one({"id": request_id, "status": "pending"}, {"_id": 0})
    if not deletion:
        raise HTTPException(status_code=404, detail="Pending deletion request not found")
    now = datetime.now(timezone.utc)
    updates: Dict[str, Any] = {"status": payload.status, "decision_notes": payload.notes, "decided_at": now, "decided_by": user["id"]}
    if payload.status == "approved":
        last_order = await db.orders.find_one({"customer_id": deletion["user_id"]}, {"_id": 0, "created_at": 1}, sort=[("created_at", -1)])
        eligible_at = now + timedelta(days=ACCOUNT_DELETION_GRACE_DAYS)
        if last_order and last_order.get("created_at"):
            created_at = last_order["created_at"]
            if created_at.tzinfo is None: created_at = created_at.replace(tzinfo=timezone.utc)
            eligible_at = max(eligible_at, created_at + timedelta(days=ORDER_PII_RETENTION_DAYS))
        updates["eligible_at"] = eligible_at
        await db.users.update_one({"id": deletion["user_id"]}, {"$set": {"deletion_pending": True, "deletion_eligible_at": eligible_at}})
    await db.account_deletion_requests.update_one({"id": request_id, "status": "pending"}, {"$set": updates, "$push": {"history": {"status": payload.status, "notes": payload.notes, "actor_id": user["id"], "at": now}}})
    await db.audit_logs.insert_one({"id": str(uuid.uuid4()), "actor_id": user["id"], "action": f"account.deletion_{payload.status}", "entity_type": "account_deletion_request", "entity_id": request_id, "created_at": now})
    return await db.account_deletion_requests.find_one({"id": request_id}, {"_id": 0, "email": 0})

@api_router.post("/admin/privacy/deletion-requests/{request_id}/fulfill")
async def fulfill_account_deletion(request_id: str, user: Dict[str, Any] = Depends(require_super_admin)):
    deletion = await db.account_deletion_requests.find_one({"id": request_id, "status": "approved"}, {"_id": 0})
    if not deletion:
        raise HTTPException(status_code=404, detail="Approved deletion request not found")
    now = datetime.now(timezone.utc)
    eligible_at = deletion.get("eligible_at")
    if eligible_at and eligible_at.tzinfo is None: eligible_at = eligible_at.replace(tzinfo=timezone.utc)
    if not eligible_at or eligible_at > now:
        raise HTTPException(status_code=409, detail=f"Retention period remains active until {eligible_at.isoformat() if eligible_at else 'reviewed'}")
    active_statuses = [status.value for status in OrderStatus if status not in {OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.RETURNED, OrderStatus.REFUNDED}]
    if await db.orders.find_one({"customer_id": deletion["user_id"], "status": {"$in": active_statuses}}):
        raise HTTPException(status_code=409, detail="Account still has an active order")
    user_id = deletion["user_id"]
    anonymous_email = f"deleted-{hashlib.sha256(user_id.encode()).hexdigest()[:20]}@privacy.invalid"

    async def anonymize(mongo_session=None):
        kwargs = {"session": mongo_session} if mongo_session else {}
        await db.users.update_one({"id": user_id}, {"$set": {"email": anonymous_email, "name": "Deleted Customer", "phone": None, "profile_picture": None, "bio": None, "password_hash": hash_password(secrets.token_urlsafe(32)), "is_active": False, "deletion_pending": False, "anonymized_at": now}}, **kwargs)
        for collection in (db.auth_sessions, db.addresses, db.user_settings, db.notification_preferences, db.review_helpful_votes):
            await collection.delete_many({"user_id": user_id}, **kwargs)
        await db.reviews.update_many({"customer_id": user_id}, {"$set": {"customer_name": "Deleted Customer", "comment": None, "images": [], "anonymized_at": now}}, **kwargs)
        await db.support_tickets.update_many({"user_id": user_id}, {"$set": {"subject": "Account data removed", "message": "Content removed under account deletion policy", "anonymized_at": now}}, **kwargs)
        await db.orders.update_many({"customer_id": user_id}, {"$set": {"shipping_address": {"status": "removed after retention"}, "customer_data_anonymized_at": now}}, **kwargs)
        await db.account_deletion_requests.update_one({"id": request_id, "status": "approved"}, {"$set": {"status": "completed", "completed_at": now, "completed_by": user["id"], "email": anonymous_email, "reason": None}, "$push": {"history": {"status": "completed", "actor_id": user["id"], "at": now}}}, **kwargs)
        await db.audit_logs.insert_one({"id": str(uuid.uuid4()), "actor_id": user["id"], "action": "account.deletion_completed", "entity_type": "user", "entity_id": user_id, "request_id": request_id, "created_at": now}, **kwargs)

    if USE_MOCK_DB:
        await anonymize()
    else:
        async with await client.start_session() as mongo_session:
            async with mongo_session.start_transaction(): await anonymize(mongo_session)
    return {"message": "Customer data anonymized under the retention policy", "request_id": request_id}

# ============== REVIEW ENHANCEMENTS ==============
@api_router.put("/reviews/{review_id}/helpful")
async def mark_review_helpful(review_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    review = await db.reviews.find_one({"id": review_id, "$or": [{"moderation_status": "approved"}, {"moderation_status": {"$exists": False}}]})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    try:
        await db.review_helpful_votes.insert_one({"id": f"{review_id}:{user['id']}", "review_id": review_id, "user_id": user["id"], "created_at": datetime.now(timezone.utc)})
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Review already marked helpful")
    await db.reviews.update_one({"id": review_id}, {"$inc": {"helpful_count": 1}})
    return {"message": "Marked as helpful"}

@api_router.get("/reviews/product/{product_id}/summary")
async def get_review_summary(product_id: str):
    reviews = await db.reviews.find({"product_id": product_id, "$or": [{"moderation_status": "approved"}, {"moderation_status": {"$exists": False}}]}, {"_id": 0}).to_list(10000)
    
    if not reviews:
        return {
            "total_reviews": 0,
            "average_rating": 0,
            "rating_distribution": {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
        }
    
    total = len(reviews)
    avg_rating = sum(r["rating"] for r in reviews) / total
    
    distribution = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
    for review in reviews:
        distribution[review["rating"]] += 1
    
    return {
        "total_reviews": total,
        "average_rating": round(avg_rating, 1),
        "rating_distribution": distribution,
        "reviews_with_photos": len([r for r in reviews if r.get("images")])
    }

async def refresh_product_review_aggregate(product_id: str) -> None:
    reviews = await db.reviews.find({"product_id": product_id, "moderation_status": "approved"}, {"rating": 1}).to_list(10000)
    average = round(sum(item["rating"] for item in reviews) / len(reviews), 1) if reviews else 0
    await db.products.update_one({"id": product_id}, {"$set": {"average_rating": average, "review_count": len(reviews), "updated_at": datetime.now(timezone.utc)}})

@api_router.get("/admin/reviews")
async def list_reviews_for_moderation(
    status: Optional[Literal["pending", "approved", "rejected", "flagged"]] = None,
    q: Optional[str] = Query(default=None, max_length=100), page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN])),
):
    query: Dict[str, Any] = {}
    if status: query["moderation_status"] = status
    if q: query["$or"] = [{"customer_name": {"$regex": re.escape(q), "$options": "i"}}, {"comment": {"$regex": re.escape(q), "$options": "i"}}, {"product_id": {"$regex": re.escape(q), "$options": "i"}}]
    total = await db.reviews.count_documents(query)
    items = await db.reviews.find(query, {"_id": 0}).sort("created_at", -1).skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size, "pages": max(1, (total + page_size - 1) // page_size)}

@api_router.patch("/admin/reviews/{review_id}")
async def moderate_review(review_id: str, payload: ReviewModerationUpdate, user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))):
    review = await db.reviews.find_one({"id": review_id}, {"_id": 0})
    if not review: raise HTTPException(status_code=404, detail="Review not found")
    now = datetime.now(timezone.utc)
    history = {"from": review.get("moderation_status", "legacy"), "status": payload.status, "reason": payload.reason, "actor_id": user["id"], "at": now}
    await db.reviews.update_one({"id": review_id}, {"$set": {"moderation_status": payload.status, "admin_reply": payload.admin_reply, "moderated_at": now, "moderated_by": user["id"]}, "$push": {"moderation_history": history}})
    await db.audit_logs.insert_one({"id": str(uuid.uuid4()), "actor_id": user["id"], "action": "review.moderated", "entity_type": "review", "entity_id": review_id, "before": {"status": review.get("moderation_status")}, "after": {"status": payload.status, "reason": payload.reason}, "created_at": now})
    await refresh_product_review_aggregate(review["product_id"])
    return await db.reviews.find_one({"id": review_id}, {"_id": 0})

# ============== DELIVERY PARTNER APIS ==============
@api_router.post("/delivery-partners/register")
async def register_delivery_partner(
    partner_data: DeliveryPartnerCreate,
    password: str,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Admin creates delivery partner account"""
    # Check if email exists
    existing = await db.users.find_one({"email": partner_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user account with delivery_partner role
    new_user = User(
        email=partner_data.email,
        password_hash=hash_password(password),
        name=partner_data.company_name,
        phone=partner_data.contact_number,
        role=UserRole.DELIVERY_PARTNER
    )
    await db.users.insert_one(new_user.model_dump())
    
    # Create delivery partner profile
    partner_dict = partner_data.model_dump()
    partner_dict["user_id"] = new_user.id
    partner = DeliveryPartner(**partner_dict)
    await db.delivery_partners.insert_one(partner.model_dump())
    
    return partner

@api_router.get("/delivery-partners")
async def list_delivery_partners(
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN, UserRole.SELLER]))
):
    """List all active delivery partners"""
    partners = await db.delivery_partners.find(
        {"is_active": True},
        {"_id": 0}
    ).to_list(100)
    return partners

@api_router.get("/delivery-partners/my")
async def get_my_delivery_partner_profile(user: Dict[str, Any] = Depends(get_current_user)):
    """Get delivery partner's own profile"""
    partner = await db.delivery_partners.find_one({"user_id": user["id"]}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner profile not found")
    return partner

@api_router.put("/delivery-partners/{partner_id}")
async def update_delivery_partner(
    partner_id: str,
    updates: DeliveryPartnerUpdate,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Update delivery partner details"""
    partner = await db.delivery_partners.find_one({"id": partner_id})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if update_data:
        await db.delivery_partners.update_one(
            {"id": partner_id},
            {"$set": update_data}
        )
    
    updated = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    return updated

# ============== WAREHOUSE MANAGEMENT APIS ==============
@api_router.post("/warehouses", response_model=Warehouse)
async def create_warehouse(
    warehouse_data: WarehouseCreate,
    user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))
):
    """Seller creates warehouse/pickup address"""
    # Get seller profile
    seller = await db.sellers.find_one({"user_id": user["id"]})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    # If this is default, unset others
    if warehouse_data.is_default:
        await db.warehouses.update_many(
            {"seller_id": seller["id"]},
            {"$set": {"is_default": False}}
        )
    
    # Check if this is first warehouse
    existing_count = await db.warehouses.count_documents({"seller_id": seller["id"]})
    
    warehouse_dict = warehouse_data.model_dump()
    warehouse_dict["seller_id"] = seller["id"]
    warehouse_dict["is_default"] = warehouse_data.is_default or existing_count == 0
    
    warehouse = Warehouse(**warehouse_dict)
    await db.warehouses.insert_one(warehouse.model_dump())
    return warehouse

@api_router.get("/warehouses", response_model=List[Warehouse])
async def get_warehouses(user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))):
    """Get all warehouses for seller"""
    seller = await db.sellers.find_one({"user_id": user["id"]})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    warehouses = await db.warehouses.find(
        {"seller_id": seller["id"]},
        {"_id": 0}
    ).sort("is_default", -1).to_list(100)
    return warehouses

@api_router.put("/warehouses/{warehouse_id}", response_model=Warehouse)
async def update_warehouse(
    warehouse_id: str,
    warehouse_data: WarehouseCreate,
    user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))
):
    """Update warehouse details"""
    seller = await db.sellers.find_one({"user_id": user["id"]})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    warehouse = await db.warehouses.find_one({"id": warehouse_id, "seller_id": seller["id"]})
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    # If setting as default, unset others
    if warehouse_data.is_default:
        await db.warehouses.update_many(
            {"seller_id": seller["id"], "id": {"$ne": warehouse_id}},
            {"$set": {"is_default": False}}
        )
    
    await db.warehouses.update_one(
        {"id": warehouse_id},
        {"$set": warehouse_data.model_dump()}
    )
    
    updated = await db.warehouses.find_one({"id": warehouse_id}, {"_id": 0})
    return updated

@api_router.delete("/warehouses/{warehouse_id}")
async def delete_warehouse(
    warehouse_id: str,
    user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))
):
    """Delete warehouse"""
    seller = await db.sellers.find_one({"user_id": user["id"]})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    warehouse = await db.warehouses.find_one({"id": warehouse_id, "seller_id": seller["id"]})
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    await db.warehouses.delete_one({"id": warehouse_id})
    
    # If deleted warehouse was default, set another as default
    if warehouse.get("is_default"):
        first_warehouse = await db.warehouses.find_one({"seller_id": seller["id"]})
        if first_warehouse:
            await db.warehouses.update_one(
                {"id": first_warehouse["id"]},
                {"$set": {"is_default": True}}
            )
    
    return {"message": "Warehouse deleted"}

# ============== SHIPPING SETTINGS APIS ==============
@api_router.get("/shipping-settings")
async def get_shipping_settings(user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))):
    """Get seller's shipping settings"""
    seller = await db.sellers.find_one({"user_id": user["id"]})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    settings = await db.shipping_settings.find_one({"seller_id": seller["id"]}, {"_id": 0})
    
    if not settings:
        # Create default settings
        settings = ShippingSettings(seller_id=seller["id"]).model_dump()
        await db.shipping_settings.insert_one(settings)
    
    return settings

@api_router.put("/shipping-settings")
async def update_shipping_settings(
    updates: ShippingSettingsUpdate,
    user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))
):
    """Update shipping settings"""
    seller = await db.sellers.find_one({"user_id": user["id"]})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.shipping_settings.update_one(
        {"seller_id": seller["id"]},
        {"$set": update_data},
        upsert=True
    )
    
    settings = await db.shipping_settings.find_one({"seller_id": seller["id"]}, {"_id": 0})
    return settings

# ============== BUSINESS VERIFICATION APIS ==============
@api_router.get("/business-verification")
async def get_business_verification(user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))):
    """Get seller's business verification status"""
    seller = await db.sellers.find_one({"user_id": user["id"]})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    verification = await db.business_verification.find_one({"seller_id": seller["id"]}, {"_id": 0})
    
    if not verification:
        # Create default verification record
        verification = BusinessVerification(seller_id=seller["id"]).model_dump()
        await db.business_verification.insert_one(verification)
    
    return verification

@api_router.put("/business-verification")
async def update_business_verification(
    updates: BusinessVerificationUpdate,
    user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))
):
    """Update business verification details"""
    seller = await db.sellers.find_one({"user_id": user["id"]})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.business_verification.update_one(
        {"seller_id": seller["id"]},
        {"$set": update_data},
        upsert=True
    )
    
    verification = await db.business_verification.find_one({"seller_id": seller["id"]}, {"_id": 0})
    return verification

@api_router.put("/admin/business-verification/{seller_id}/verify")
async def verify_business(
    seller_id: str,
    field: str,  # gst, pan, bank, aadhaar
    verified: bool,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Admin verifies seller's business documents"""
    update_field = f"{field}_verified"
    update_data = {
        update_field: verified,
        "updated_at": datetime.now(timezone.utc)
    }
    
    if verified:
        # Check if all fields are verified
        verification = await db.business_verification.find_one({"seller_id": seller_id})
        if verification:
            all_verified = (
                verification.get("gst_verified", False) and
                verification.get("pan_verified", False) and
                verification.get("bank_verified", False)
            )
            if all_verified:
                update_data["verification_status"] = "verified"
                update_data["verified_at"] = datetime.now(timezone.utc)
    
    await db.business_verification.update_one(
        {"seller_id": seller_id},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": f"{field.upper()} verification updated"}

# ============== SELLER PERFORMANCE APIS ==============
@api_router.get("/seller-performance")
async def get_seller_performance(user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))):
    """Get seller's performance metrics"""
    seller = await db.sellers.find_one({"user_id": user["id"]})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    # Update performance metrics
    await update_seller_performance(seller["id"])
    
    performance = await db.seller_performance.find_one({"seller_id": seller["id"]}, {"_id": 0})
    
    if not performance:
        performance = SellerPerformance(seller_id=seller["id"]).model_dump()
    
    return performance

@api_router.get("/admin/seller-performance/{seller_id}")
async def get_seller_performance_admin(
    seller_id: str,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Admin views seller performance"""
    await update_seller_performance(seller_id)
    performance = await db.seller_performance.find_one({"seller_id": seller_id}, {"_id": 0})
    
    if not performance:
        performance = SellerPerformance(seller_id=seller_id).model_dump()
    
    return performance

# ============== SHIPPING LABEL & TRACKING APIS ==============
@api_router.post("/shipping-labels", response_model=ShippingLabel)
async def create_shipping_label(
    label_data: ShippingLabelCreate,
    user: Dict[str, Any] = Depends(require_role([UserRole.SELLER, UserRole.ADMIN]))
):
    """Generate shipping label with tracking ID and barcode"""
    # Verify seller owns this order
    order = await db.orders.find_one({"id": label_data.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if user["role"] == UserRole.ADMIN.value:
        seller_items = order.get("items", [])
    else:
        seller = await db.sellers.find_one({"user_id": user["id"]})
        if not seller:
            raise HTTPException(status_code=404, detail="Seller profile not found")
        seller_items = [item for item in order["items"] if item.get("seller_id") == seller["id"]]
        if not seller_items:
            raise HTTPException(status_code=403, detail="You don't have items in this order")
    
    # Check if label already exists
    existing_label = await db.shipping_labels.find_one({"order_id": label_data.order_id})
    if existing_label:
        return existing_label
    
    # Generate a local identifier, or replace it with the configured carrier response.
    tracking_id = generate_tracking_id()
    barcode = generate_barcode(tracking_id)
    provider_reference = None
    label_url = None
    if SHIPPING_PROVIDER_API_URL:
        headers = {"Content-Type": "application/json"}
        if SHIPPING_PROVIDER_API_TOKEN:
            headers["Authorization"] = f"Bearer {SHIPPING_PROVIDER_API_TOKEN}"
        provider_payload = {
            "order_id": order["id"], "items": seller_items, "shipping_address": order.get("shipping_address"),
            "warehouse_id": label_data.warehouse_id, "weight": label_data.weight,
            "dimensions": label_data.dimensions, "callback_url": f"{PUBLIC_API_URL}/api/shipping/webhook",
        }
        try:
            provider_response = await asyncio.to_thread(requests.post, SHIPPING_PROVIDER_API_URL, json=provider_payload, headers=headers, timeout=15)
            provider_response.raise_for_status()
            provider_data = provider_response.json()
            tracking_id = provider_data.get("tracking_id") or provider_data.get("awb")
            if not tracking_id:
                raise ValueError("Carrier response did not include tracking_id or awb")
            barcode = provider_data.get("barcode") or tracking_id
            provider_reference = provider_data.get("id") or provider_data.get("reference")
            label_url = provider_data.get("label_url")
        except (requests.RequestException, ValueError, TypeError) as error:
            logger.warning("Shipping provider label request failed: %s", type(error).__name__)
            raise HTTPException(status_code=502, detail="Shipping provider could not create a label")
    
    # Get delivery partner name if provided
    delivery_partner_name = None
    if label_data.delivery_partner_id:
        partner = await db.delivery_partners.find_one({"id": label_data.delivery_partner_id})
        if partner:
            delivery_partner_name = partner["company_name"]
    
    # Create shipping label
    label_dict = label_data.model_dump()
    label_dict["tracking_id"] = tracking_id
    label_dict["barcode"] = barcode
    label_dict["delivery_partner_name"] = delivery_partner_name
    label_dict["provider_reference"] = provider_reference
    label_dict["label_url"] = label_url
    
    label = ShippingLabel(**label_dict)
    await db.shipping_labels.insert_one(label.model_dump())
    
    # Update order with tracking info
    await db.orders.update_one(
        {"id": label_data.order_id},
        {
            "$set": {
                "tracking_id": tracking_id,
                "barcode": barcode,
                "delivery_partner_id": label_data.delivery_partner_id,
                "delivery_partner_name": delivery_partner_name,
                "warehouse_id": label_data.warehouse_id,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return label

@api_router.get("/shipping-labels/{order_id}/download")
async def download_shipping_label(
    order_id: str,
    user: Dict[str, Any] = Depends(require_role([UserRole.SELLER, UserRole.ADMIN]))
):
    """Return a Perfurm-branded 4x6 courier label suitable for thermal printing."""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    label = await db.shipping_labels.find_one({"order_id": order_id}, {"_id": 0})
    if not order or not label:
        raise HTTPException(status_code=404, detail="Generate the shipping label before downloading")
    if user["role"] == UserRole.SELLER.value:
        seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
        if not seller or not any(item.get("seller_id") == seller["id"] for item in order.get("items", [])):
            raise HTTPException(status_code=403, detail="Order access denied")

    address = order.get("shipping_address") or {}
    address_line = address.get("address") or address.get("address_line") or address.get("address_line1") or ""
    locality = ", ".join(filter(None, [address.get("landmark"), address.get("city"), address.get("state")]))
    item_rows = "".join(
        f"<tr><td>{html.escape(str(item.get('name', 'Product')))}</td><td>{html.escape(str(item.get('size', '—')))}</td><td>{int(item.get('quantity', 1))}</td></tr>"
        for item in order.get("items", [])
    )
    payment = "COD" if order.get("payment_method") == "cod" else "PREPAID"
    cod_value = f"Collect ₹{float(order.get('total_amount', 0)):.2f}" if payment == "COD" else "Do not collect cash"
    tracking = html.escape(str(label["tracking_id"]))
    document = f"""<!doctype html><html><head><meta charset='utf-8'><title>Perfurm shipping label {tracking}</title>
    <style>@page{{size:4in 6in;margin:0}}*{{box-sizing:border-box}}body{{margin:0;font:12px Arial;color:#111}}.label{{width:4in;min-height:6in;border:2px solid #111;padding:12px}}.top{{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:9px}}.brand{{font:700 26px Georgia;color:#6f3b49}}.mode{{font-size:17px;font-weight:800;border:2px solid #111;padding:5px 8px}}h2{{font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin:12px 0 5px}}.recipient{{font-size:15px;line-height:1.35}}.pin{{font-size:25px;font-weight:900;margin-top:6px}}.barcode{{font:700 16px monospace;letter-spacing:2px;text-align:center;border-block:2px solid #111;margin:12px 0;padding:13px 4px;overflow-wrap:anywhere}}table{{width:100%;border-collapse:collapse}}th,td{{border:1px solid #555;padding:5px;text-align:left}}.meta{{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}}.small{{font-size:10px}}@media print{{.label{{border:0}}}}</style></head><body><main class='label'>
    <div class='top'><div><div class='brand'>perfurm</div><div class='small'>FRAGRANCE, DELIVERED</div></div><div class='mode'>{payment}</div></div>
    <h2>Ship to</h2><div class='recipient'><b>{html.escape(str(address.get('name') or 'Customer'))}</b><br>{html.escape(str(address_line))}<br>{html.escape(locality)}<br><b>Phone:</b> {html.escape(str(address.get('phone') or 'Not provided'))}</div><div class='pin'>{html.escape(str(address.get('pincode') or ''))}</div>
    <div class='barcode'>||| || ||| | |||| | |||<br>{tracking}</div>
    <div class='meta'><div><b>Order</b><br>{html.escape(order_id)}</div><div><b>Payment</b><br>{cod_value}</div><div><b>Weight</b><br>{float(label.get('weight') or 0):.2f} kg</div><div><b>Package</b><br>1 of 1</div></div>
    <h2>Contents</h2><table><thead><tr><th>Item</th><th>Size</th><th>Qty</th></tr></thead><tbody>{item_rows}</tbody></table>
    <p class='small'><b>Return to:</b> Perfurm fulfilment centre · Warehouse {html.escape(str(label.get('warehouse_id') or 'MAIN'))}. Scan/enter the tracking ID for carrier updates.</p>
    </main></body></html>"""
    return Response(content=document, media_type="text/html", headers={"Content-Disposition": f'attachment; filename="perfurm-label-{order_id}.html"', "Cache-Control": "private, no-store"})

@api_router.get("/shipping-labels/{order_id}")
async def get_shipping_label(
    order_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get shipping label for an order"""
    label = await db.shipping_labels.find_one({"order_id": order_id}, {"_id": 0})
    if not label:
        raise HTTPException(status_code=404, detail="Shipping label not found")
    
    return label

@api_router.get("/orders/{order_id}/tracking")
async def track_order(order_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    """Track an order after verifying customer or operational ownership."""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if user.get("role") == UserRole.CUSTOMER.value and order.get("customer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Order access denied")
    if user.get("role") == UserRole.SELLER.value:
        seller = await db.sellers.find_one({"user_id": user["id"]})
        if not seller or not any(item.get("seller_id") == seller["id"] for item in order.get("items", [])):
            raise HTTPException(status_code=403, detail="Order access denied")

    # Get delivery status history
    delivery_history = await db.delivery_status.find(
        {"order_id": order_id},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(100)
    
    # Get shipping label
    label = await db.shipping_labels.find_one({"order_id": order_id}, {"_id": 0})
    
    return {
        "order": order,
        "label": label,
        "delivery_history": delivery_history
    }

@api_router.post("/shipping/webhook")
async def shipping_provider_webhook(request: Request):
    if not SHIPPING_PROVIDER_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Shipping webhook is not configured")
    raw_body = await request.body()
    supplied = request.headers.get("X-Shipping-Signature", "")
    expected = hmac.new(SHIPPING_PROVIDER_WEBHOOK_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Invalid shipping webhook signature")
    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    event_id = str(payload.get("event_id") or request.headers.get("X-Event-Id") or "")
    tracking_id = payload.get("tracking_id") or payload.get("awb")
    carrier_status = str(payload.get("status", "")).lower()
    if not event_id or not tracking_id or not carrier_status:
        raise HTTPException(status_code=422, detail="event_id, tracking_id/awb and status are required")
    try:
        await db.shipping_events.insert_one({"id": event_id, "tracking_id": tracking_id, "payload": payload, "received_at": datetime.now(timezone.utc)})
    except DuplicateKeyError:
        return {"received": True, "duplicate": True}
    label = await db.shipping_labels.find_one({"tracking_id": tracking_id})
    if not label:
        raise HTTPException(status_code=404, detail="Tracking label not found")
    now = datetime.now(timezone.utc)
    await db.delivery_status.insert_one(DeliveryStatus(order_id=label["order_id"], tracking_id=tracking_id, status=carrier_status, location=payload.get("location"), remarks=payload.get("remarks"), updated_by="shipping_provider", timestamp=now).model_dump())
    order_status = {"picked_up": OrderStatus.SHIPPED.value, "in_transit": OrderStatus.SHIPPED.value, "out_for_delivery": OrderStatus.OUT_FOR_DELIVERY.value, "delivered": OrderStatus.DELIVERED.value}.get(carrier_status)
    if order_status:
        await db.orders.update_one({"id": label["order_id"]}, {"$set": {"status": order_status, "updated_at": now}, "$push": {"status_history": {"status": order_status, "at": now, "source": "shipping_webhook", "event_id": event_id}}})
    return {"received": True}

# ============== DELIVERY STATUS APIS (For Delivery Partners) ==============
@api_router.post("/delivery-status/{order_id}")
async def update_delivery_status(
    order_id: str,
    status_update: DeliveryStatusUpdate,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Delivery partner updates order delivery status"""
    # Get order
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Verify user is delivery partner or seller
    partner = await db.delivery_partners.find_one({"user_id": user["id"]})
    seller = await db.sellers.find_one({"user_id": user["id"]})
    
    if not partner and not seller and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Create delivery status record
    status_dict = status_update.model_dump()
    status_dict["order_id"] = order_id
    status_dict["tracking_id"] = order.get("tracking_id", "")
    status_dict["updated_by"] = user["id"]
    
    delivery_status = DeliveryStatus(**status_dict)
    await db.delivery_status.insert_one(delivery_status.model_dump())
    
    # Update order status based on delivery status
    order_status_map = {
        "picked_up": "packed",
        "in_transit": "shipped",
        "out_for_delivery": "out_for_delivery",
        "delivered": "delivered",
        "failed": "pending"
    }
    
    status_messages = {
        "picked_up": "Your order has been picked up from the warehouse",
        "in_transit": "Your order is in transit",
        "out_for_delivery": "Your order is out for delivery - arriving today!",
        "delivered": "Your order has been delivered successfully!",
        "failed": "Delivery attempt failed. We'll try again soon."
    }
    
    if status_update.status in order_status_map:
        await db.orders.update_one(
            {"id": order_id},
            {
                "$set": {
                    "status": order_status_map[status_update.status],
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        # Send notification to customer
        notification = Notification(
            user_id=order["customer_id"],
            title=f"Order Update - {status_update.status.replace('_', ' ').title()}",
            message=status_messages.get(status_update.status, f"Order status: {status_update.status}"),
            type="delivery_update",
            link_url=f"/customer/orders/{order_id}"
        )
        await db.notifications.insert_one(notification.model_dump())
    
    return {"message": "Delivery status updated", "status": delivery_status}

@api_router.get("/delivery-partner/orders")
async def get_delivery_partner_orders(user: Dict[str, Any] = Depends(get_current_user)):
    """Get all orders assigned to delivery partner"""
    partner = await db.delivery_partners.find_one({"user_id": user["id"]})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner profile not found")
    
    # Get orders assigned to this partner
    orders = await db.orders.find(
        {"delivery_partner_id": partner["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return orders

# ============== PLATFORM FEE APIS ==============
@api_router.get("/platform-fees/my")
async def get_my_platform_fees(user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))):
    """Get seller's platform fee records"""
    seller = await db.sellers.find_one({"user_id": user["id"]})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    fees = await db.platform_fees.find(
        {"seller_id": seller["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Calculate totals
    total_fees = sum([f["fee_amount"] for f in fees])
    total_payout = sum([f["seller_payout"] for f in fees])
    
    return {
        "fees": fees,
        "summary": {
            "total_orders": len(fees),
            "total_fee_amount": round(total_fees, 2),
            "total_seller_payout": round(total_payout, 2)
        }
    }

@api_router.get("/admin/platform-fees")
async def get_all_platform_fees(user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))):
    """Admin views all platform fees"""
    fees = await db.platform_fees.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Calculate totals
    total_fees = sum([f["fee_amount"] for f in fees])
    total_orders = len(fees)
    
    return {
        "fees": fees,
        "summary": {
            "total_orders": total_orders,
            "total_platform_revenue": round(total_fees, 2)
        }
    }

# ============== RAZORPAY PAYMENT APIS ==============
class CreatePaymentOrder(BaseModel):
    amount: float  # Amount in INR (will be converted to paise)
    order_id: Optional[str] = None  # Internal order ID if already created
    notes: Optional[Dict[str, str]] = None

class VerifyPayment(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    internal_order_id: str

class DemoPaymentConfirm(BaseModel):
    internal_order_id: str

class RefundCreate(BaseModel):
    amount: Optional[float] = Field(default=None, gt=0)
    reason: str = Field(min_length=3, max_length=500)

@api_router.get("/payments/config")
async def get_payment_config():
    """Expose only browser-safe gateway availability and the public checkout key."""
    return {
        "provider": "razorpay",
        "configured": bool(razorpay_client and os.environ.get("RAZORPAY_KEY_ID")),
        "key_id": os.environ.get("RAZORPAY_KEY_ID") if razorpay_client else None,
        "cod_available": True,
        "demo_available": APP_ENV in {"development", "test"} and USE_MOCK_DB,
    }

@api_router.get("/admin/integrations/status")
async def integration_status(user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))):
    """Configuration-only readiness; never exposes provider secrets."""
    return {
        "environment": APP_ENV,
        "payments": {"provider": "razorpay", "configured": bool(razorpay_client and os.environ.get("RAZORPAY_WEBHOOK_SECRET"))},
        "shipping": {"provider": "custom_http_adapter", "configured": bool(SHIPPING_PROVIDER_API_URL and SHIPPING_PROVIDER_WEBHOOK_SECRET)},
        "email": {"provider": "smtp", "configured": bool(SMTP_HOST and SMTP_FROM_EMAIL)},
        "sms": {"provider": "webhook_adapter", "configured": bool(SMS_WEBHOOK_URL)},
        "reverse_geocoding": {"provider": "configured_http_adapter", "configured": "{latitude}" in REVERSE_GEOCODING_URL and "{longitude}" in REVERSE_GEOCODING_URL},
        "database": {"provider": "mongodb", "configured": bool(mongo_url)},
        "monitoring": {"provider": "prometheus", "configured": bool(METRICS_TOKEN)},
        "notifications_enabled": NOTIFICATION_DELIVERY_ENABLED,
    }

@api_router.post("/payments/demo-confirm")
async def confirm_demo_payment(payload: DemoPaymentConfirm, user: Dict[str, Any] = Depends(require_role([UserRole.CUSTOMER]))):
    """Confirm a simulated payment only in the isolated mock preview environment."""
    if not (APP_ENV in {"development", "test"} and USE_MOCK_DB):
        raise HTTPException(status_code=404, detail="Demo payment is not available")
    order = await db.orders.find_one({"id": payload.internal_order_id, "customer_id": user["id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    now = datetime.now(timezone.utc)
    demo_payment_id = f"demo_pay_{uuid.uuid4().hex[:16]}"
    updated = await mark_order_paid_and_finalize(order, {"id": order["id"], "customer_id": user["id"], "payment_status": {"$ne": "paid"}}, {
        "$set": {"payment_status": "paid", "status": OrderStatus.CONFIRMED.value, "payment_id": demo_payment_id, "paid_at": now},
        "$push": {
            "payment_history": {"status": "paid", "at": now, "provider": "demo", "payment_id": demo_payment_id, "source": "demo_checkout"},
            "status_history": {"status": OrderStatus.CONFIRMED.value, "at": now, "actor_id": user["id"], "source": "demo_payment"},
        },
    })
    return {"status": "success", "order_id": order["id"], "payment_id": demo_payment_id, "already_paid": not updated}

@api_router.post("/payments/create-order")
async def create_payment_order(
    payment_data: CreatePaymentOrder,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Create a Razorpay order for payment"""
    if not razorpay_client:
        raise HTTPException(
            status_code=503, 
            detail="Payment gateway not configured. Please contact admin."
        )
    
    if not payment_data.order_id:
        raise HTTPException(status_code=400, detail="Internal order ID is required")
    order = await db.orders.find_one({"id": payment_data.order_id, "customer_id": user["id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=409, detail="Order is already paid")

    if order.get("razorpay_order_id"):
        return {
            "razorpay_order_id": order["razorpay_order_id"],
            "amount": int(round(float(order["total_amount"]) * 100)),
            "currency": "INR",
            "key_id": os.environ.get("RAZORPAY_KEY_ID"),
            "internal_order_id": order["id"],
        }

    try:
        # The charge is derived only from the trusted internal order.
        amount_in_paise = int(round(float(order["total_amount"]) * 100))
        
        # Create Razorpay order
        razorpay_order = razorpay_client.order.create({
            "amount": amount_in_paise,
            "currency": "INR",
            "payment_capture": 1,  # Auto capture payment
            "notes": payment_data.notes or {}
        })
        await db.orders.update_one(
            {"id": order["id"], "customer_id": user["id"]},
            {
                "$set": {"razorpay_order_id": razorpay_order["id"], "status": OrderStatus.PAYMENT_PENDING.value},
                "$push": {"status_history": {
                    "status": OrderStatus.PAYMENT_PENDING.value, "at": datetime.now(timezone.utc),
                    "actor_id": user["id"], "source": "payment_order",
                }},
            }
        )
        
        return {
            "razorpay_order_id": razorpay_order["id"],
            "amount": amount_in_paise,
            "currency": "INR",
            "key_id": os.environ.get('RAZORPAY_KEY_ID'),
            "internal_order_id": payment_data.order_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create payment order: {str(e)}")

@api_router.post("/payments/verify")
async def verify_payment(
    verification_data: VerifyPayment,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Verify Razorpay payment signature and update order"""
    if not razorpay_client:
        raise HTTPException(
            status_code=503, 
            detail="Payment gateway not configured"
        )
    
    order = await db.orders.find_one({
        "id": verification_data.internal_order_id,
        "customer_id": user["id"],
        "razorpay_order_id": verification_data.razorpay_order_id,
    })
    if not order:
        raise HTTPException(status_code=404, detail="Matching order not found")

    try:
        # Verify signature
        razorpay_client.utility.verify_payment_signature({
            'razorpay_order_id': verification_data.razorpay_order_id,
            'razorpay_payment_id': verification_data.razorpay_payment_id,
            'razorpay_signature': verification_data.razorpay_signature
        })
        
        # Payment state and reserved-stock finalization commit together on real MongoDB.
        updated = await mark_order_paid_and_finalize(
            order,
            {
                "id": verification_data.internal_order_id,
                "customer_id": user["id"],
                "payment_status": {"$ne": "paid"},
            },
            {
                "$set": {
                    "payment_status": "paid",
                    "status": OrderStatus.CONFIRMED.value,
                    "payment_id": verification_data.razorpay_payment_id,
                    "razorpay_order_id": verification_data.razorpay_order_id,
                    "paid_at": datetime.now(timezone.utc)
                },
                "$push": {
                    "payment_history": {
                        "status": "paid", "at": datetime.now(timezone.utc),
                        "provider": "razorpay", "payment_id": verification_data.razorpay_payment_id,
                        "source": "signature_verification",
                    },
                    "status_history": {
                        "status": OrderStatus.CONFIRMED.value, "at": datetime.now(timezone.utc),
                        "actor_id": user["id"], "source": "payment_verification",
                    },
                },
            },
        )
        if not updated:
            return {"status": "success", "message": "Payment already verified"}
        
        return {"status": "success", "message": "Payment verified successfully"}
        
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Payment verification failed")
    except Exception as e:
        logger.exception("Payment verification failed for order %s", verification_data.internal_order_id)
        raise HTTPException(status_code=500, detail="Payment verification could not be completed")

@api_router.post("/payments/webhook", include_in_schema=False)
async def razorpay_webhook(request: Request):
    """Verify and idempotently process Razorpay server-to-server events."""
    webhook_secret = os.environ.get("RAZORPAY_WEBHOOK_SECRET")
    if not webhook_secret:
        raise HTTPException(status_code=503, detail="Payment webhook is not configured")
    raw_body = await request.body()
    received_signature = request.headers.get("X-Razorpay-Signature", "")
    expected_signature = hmac.new(
        webhook_secret.encode("utf-8"), raw_body, hashlib.sha256
    ).hexdigest()
    if not received_signature or not hmac.compare_digest(received_signature, expected_signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid webhook payload")

    event_name = payload.get("event")
    payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
    refund_entity = payload.get("payload", {}).get("refund", {}).get("entity", {})
    event_id = request.headers.get("X-Razorpay-Event-Id") or hashlib.sha256(raw_body).hexdigest()
    if await db.payment_events.find_one({"event_id": event_id}):
        return {"status": "duplicate"}

    provider_order_id = payment_entity.get("order_id")
    order = await db.orders.find_one({"razorpay_order_id": provider_order_id}) if provider_order_id else None
    if not order and refund_entity.get("payment_id"):
        order = await db.orders.find_one({"payment_id": refund_entity["payment_id"]})
    event_document = {
        "event_id": event_id, "provider": "razorpay", "event": event_name,
        "provider_order_id": provider_order_id, "received_at": datetime.now(timezone.utc),
        "processed": False,
    }
    await db.payment_events.insert_one(event_document)
    if not order:
        await db.payment_events.update_one({"event_id": event_id}, {"$set": {"processed": True, "result": "order_not_found"}})
        return {"status": "accepted"}

    now = datetime.now(timezone.utc)
    if event_name in {"payment.captured", "order.paid"}:
        payment_id = payment_entity.get("id")
        await mark_order_paid_and_finalize(
            order,
            {"id": order["id"], "payment_status": {"$ne": "paid"}},
            {
                "$set": {"payment_status": "paid", "payment_id": payment_id, "paid_at": now, "status": OrderStatus.CONFIRMED.value},
                "$push": {
                    "payment_history": {"status": "paid", "at": now, "provider": "razorpay", "payment_id": payment_id, "event_id": event_id, "source": "webhook"},
                    "status_history": {"status": OrderStatus.CONFIRMED.value, "at": now, "source": "payment_webhook"},
                },
            },
        )
    elif event_name == "payment.failed":
        await mark_order_failed_and_release(
            order,
            {
                "$set": {"payment_status": "failed", "status": OrderStatus.PAYMENT_FAILED.value},
                "$push": {
                    "payment_history": {"status": "failed", "at": now, "provider": "razorpay", "payment_id": payment_entity.get("id"), "event_id": event_id, "source": "webhook"},
                    "status_history": {"status": OrderStatus.PAYMENT_FAILED.value, "at": now, "source": "payment_webhook"},
                },
            },
        )
    elif event_name in {"refund.processed", "refund.created"}:
        provider_refund_id = refund_entity.get("id")
        internal_refund = await db.refunds.find_one({"provider_refund_id": provider_refund_id})
        if internal_refund:
            await db.refunds.update_one(
                {"id": internal_refund["id"]},
                {"$set": {
                    "status": "processed" if event_name == "refund.processed" else "pending",
                    "provider_status": refund_entity.get("status"), "updated_at": now,
                    **({"processed_at": now} if event_name == "refund.processed" else {}),
                }},
            )
        processed_refunds = await db.refunds.find(
            {"order_id": order["id"], "status": "processed"}, {"_id": 0, "amount": 1}
        ).to_list(1000)
        processed_amount = round(sum(float(item["amount"]) for item in processed_refunds), 2)
        fully_refunded = processed_amount >= float(order["total_amount"])
        refund_status = "refunded" if fully_refunded else ("partially_refunded" if event_name == "refund.processed" else "refund_pending")
        update: Dict[str, Any] = {
            "$set": {"payment_status": refund_status},
            "$push": {"payment_history": {"status": refund_status, "at": now, "provider": "razorpay", "refund_id": provider_refund_id, "amount": float(refund_entity.get("amount", 0)) / 100, "event_id": event_id, "source": "webhook"}},
        }
        if fully_refunded:
            update["$set"]["status"] = OrderStatus.REFUNDED.value
            update["$push"]["status_history"] = {"status": OrderStatus.REFUNDED.value, "at": now, "source": "payment_webhook"}
        await db.orders.update_one({"id": order["id"]}, update)

    await db.payment_events.update_one({"event_id": event_id}, {"$set": {"processed": True, "processed_at": now, "order_id": order["id"]}})
    return {"status": "accepted"}

@api_router.get("/payments/status/{order_id}")
async def get_payment_status(
    order_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get payment status for an order"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if user["role"] == UserRole.CUSTOMER.value and order["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if user["role"] not in (UserRole.CUSTOMER.value, UserRole.ADMIN.value):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return {
        "order_id": order_id,
        "payment_status": order.get("payment_status", "pending"),
        "payment_id": order.get("payment_id"),
        "paid_at": order.get("paid_at")
    }

@api_router.post("/admin/orders/{order_id}/refund")
async def create_refund(
    order_id: str, payload: RefundCreate, request: Request,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN])),
):
    if not razorpay_client:
        raise HTTPException(status_code=503, detail="Payment gateway not configured")
    idempotency_key = request.headers.get("Idempotency-Key")
    if APP_ENV in {"staging", "production"} and not idempotency_key:
        raise HTTPException(status_code=400, detail="Idempotency-Key header is required")
    if idempotency_key:
        existing = await db.refunds.find_one({"order_id": order_id, "idempotency_key": idempotency_key}, {"_id": 0})
        if existing:
            return existing
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_status") not in {"paid", "partially_refunded", "refund_pending"} or not order.get("payment_id"):
        raise HTTPException(status_code=409, detail="Only captured online payments can be refunded")
    completed_refunds = await db.refunds.find(
        {"order_id": order_id, "status": {"$in": ["pending", "processed"]}}, {"_id": 0}
    ).to_list(1000)
    already_refunded = round(sum(float(item["amount"]) for item in completed_refunds), 2)
    refundable = round(float(order["total_amount"]) - already_refunded, 2)
    amount = round(float(payload.amount if payload.amount is not None else refundable), 2)
    if amount <= 0 or amount > refundable:
        raise HTTPException(status_code=409, detail=f"Refund exceeds refundable amount of {refundable:.2f}")

    refund = {
        "id": str(uuid.uuid4()), "order_id": order_id, "customer_id": order["customer_id"],
        "payment_id": order["payment_id"], "amount": amount, "currency": "INR",
        "reason": payload.reason, "status": "creating", "idempotency_key": idempotency_key,
        "created_by": user["id"], "created_at": datetime.now(timezone.utc),
    }
    await db.refunds.insert_one(refund)
    try:
        provider_refund = razorpay_client.payment.refund(order["payment_id"], {
            "amount": int(round(amount * 100)), "speed": "normal",
            "notes": {"internal_order_id": order_id, "internal_refund_id": refund["id"], "reason": payload.reason[:200]},
            "receipt": refund["id"],
        })
    except Exception:
        logger.exception("Refund creation failed for order %s", order_id)
        await db.refunds.update_one({"id": refund["id"]}, {"$set": {"status": "failed", "failed_at": datetime.now(timezone.utc)}})
        raise HTTPException(status_code=502, detail="Payment provider could not create the refund")

    provider_status = provider_refund.get("status", "pending")
    refund_status = "processed" if provider_status == "processed" else "pending"
    now = datetime.now(timezone.utc)
    await db.refunds.update_one(
        {"id": refund["id"]},
        {"$set": {"provider_refund_id": provider_refund["id"], "provider_status": provider_status, "status": refund_status, "updated_at": now}},
    )
    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {"payment_status": "refund_pending", "status": OrderStatus.REFUND_INITIATED.value},
            "$push": {
                "payment_history": {"status": "refund_pending", "amount": amount, "refund_id": refund["id"], "provider_refund_id": provider_refund["id"], "at": now, "source": "admin"},
                "status_history": {"status": OrderStatus.REFUND_INITIATED.value, "at": now, "actor_id": user["id"], "source": "admin_refund"},
            },
        },
    )
    return await db.refunds.find_one({"id": refund["id"]}, {"_id": 0})

@api_router.get("/admin/orders/{order_id}/refunds")
async def list_order_refunds(order_id: str, user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))):
    return await db.refunds.find({"order_id": order_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)

# ============== RETURN/CANCEL ORDER APIS ==============
@api_router.get("/return-policy/seller")
async def get_seller_own_return_policy(user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))):
    """Get seller's own return/replacement policy"""
    seller = await db.sellers.find_one({"user_id": user["id"]})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    policy = await db.return_policies.find_one({"seller_id": seller["id"]}, {"_id": 0})
    if not policy:
        policy = ReturnPolicy(seller_id=seller["id"]).model_dump()
        # Convert datetime to ISO string
        if "updated_at" in policy and hasattr(policy["updated_at"], "isoformat"):
            policy["updated_at"] = policy["updated_at"].isoformat()
    else:
        if "updated_at" in policy and hasattr(policy["updated_at"], "isoformat"):
            policy["updated_at"] = policy["updated_at"].isoformat()
    return policy

@api_router.get("/return-policy/{seller_id}")
async def get_return_policy(seller_id: str):
    """Get seller's return/replacement policy"""
    policy = await db.return_policies.find_one({"seller_id": seller_id}, {"_id": 0})
    if not policy:
        policy = ReturnPolicy(seller_id=seller_id).model_dump()
    return policy

@api_router.put("/return-policy")
async def update_return_policy(
    returns_enabled: bool,
    replacement_enabled: bool,
    return_window_days: int = Query(ge=0, le=30),
    replacement_window_days: int = Query(ge=0, le=30),
    conditions: Optional[str] = None,
    user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))
):
    """Seller updates return/replacement policy"""
    seller = await db.sellers.find_one({"user_id": user["id"]})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    policy_data = {
        "seller_id": seller["id"],
        "returns_enabled": returns_enabled,
        "return_window_days": return_window_days,
        "replacement_enabled": replacement_enabled,
        "replacement_window_days": replacement_window_days,
        "conditions": conditions or "Product must be unused and in original packaging",
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.return_policies.update_one(
        {"seller_id": seller["id"]},
        {"$set": policy_data},
        upsert=True
    )
    
    return policy_data

@api_router.post("/return-requests")
async def create_return_request(
    request_data: ReturnRequestCreate,
    user: Dict[str, Any] = Depends(require_role([UserRole.CUSTOMER]))
):
    """Create one validated whole-order return, replacement, or cancellation request."""
    order = await db.orders.find_one({"id": request_data.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    seller_ids = {item.get("seller_id") for item in order.get("items", []) if item.get("seller_id")}
    if len(seller_ids) != 1:
        raise HTTPException(status_code=409, detail="Multi-seller orders require item-level support review")
    seller_id = next(iter(seller_ids))
    current_status = OrderStatus(order.get("status", OrderStatus.PENDING.value))
    now = datetime.now(timezone.utc)
    if request_data.request_type == "cancel":
        if current_status not in {OrderStatus.PENDING, OrderStatus.PAYMENT_PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING}:
            raise HTTPException(status_code=409, detail="This order can no longer be cancelled")
    else:
        if current_status != OrderStatus.DELIVERED:
            raise HTTPException(status_code=409, detail="Returns and replacements require a delivered order")
        policy = await db.return_policies.find_one({"seller_id": seller_id}, {"_id": 0}) or ReturnPolicy(seller_id=seller_id).model_dump()
        enabled_key = "returns_enabled" if request_data.request_type == "return" else "replacement_enabled"
        window_key = "return_window_days" if request_data.request_type == "return" else "replacement_window_days"
        if not policy.get(enabled_key, True):
            raise HTTPException(status_code=409, detail=f"{request_data.request_type.capitalize()} is not enabled for this order")
        delivered_entry = next(
            (entry for entry in reversed(order.get("status_history", [])) if entry.get("status") == OrderStatus.DELIVERED.value), None,
        )
        delivered_at = delivered_entry.get("at") if delivered_entry else order.get("updated_at")
        if not delivered_at or now > _coupon_datetime(delivered_at) + timedelta(days=int(policy.get(window_key, 7))):
            raise HTTPException(status_code=409, detail=f"The {request_data.request_type} window has closed")

    active_request = await db.return_requests.find_one({
        "order_id": order["id"], "status": {"$nin": ["rejected", "cancelled", "completed"]},
    })
    if active_request:
        raise HTTPException(status_code=409, detail="An active request already exists for this order")

    gross_items = round(sum(float(item["price"]) * int(item["quantity"]) for item in order.get("items", [])), 2)
    eligible_refund = round(max(gross_items - float(order.get("discount_amount", 0)), 0), 2)
    return_request = ReturnRequest(
        customer_id=user["id"],
        seller_id=seller_id,
        active_key=order["id"],
        eligible_refund_amount=eligible_refund,
        item_snapshot=order.get("items", []),
        status_history=[{"status": "pending", "at": now, "actor_id": user["id"], "source": "customer"}],
        **request_data.model_dump(),
    )

    seller = await db.sellers.find_one({"id": seller_id})
    async def persist(session=None):
        session_kwargs = {"session": session} if session is not None else {}
        await db.return_requests.insert_one(return_request.model_dump(), **session_kwargs)
        if request_data.request_type != "cancel":
            await db.orders.update_one(
                {"id": order["id"], "status": OrderStatus.DELIVERED.value},
                {"$set": {"status": OrderStatus.RETURN_REQUESTED.value, "updated_at": now}, "$push": {
                    "status_history": {"status": OrderStatus.RETURN_REQUESTED.value, "at": now, "actor_id": user["id"], "source": "customer_request"},
                }}, **session_kwargs,
            )
        if seller:
            notification = Notification(
                user_id=seller["user_id"], title=f"New {request_data.request_type.capitalize()} Request",
                message=f"Order #{request_data.order_id} requires review", type="return_request",
            )
            await db.notifications.insert_one({**notification.model_dump(), "return_request_id": return_request.id}, **session_kwargs)
    try:
        if USE_MOCK_DB:
            await persist()
        else:
            async with await client.start_session() as mongo_session:
                async with mongo_session.start_transaction():
                    await persist(mongo_session)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="A request already exists for this order")
    
    return return_request

@api_router.get("/return-requests/my")
async def get_my_return_requests(user: Dict[str, Any] = Depends(get_current_user)):
    """Get user's return requests"""
    if user["role"] == UserRole.CUSTOMER.value:
        query = {"customer_id": user["id"]}
    elif user["role"] == UserRole.SELLER.value:
        seller = await db.sellers.find_one({"user_id": user["id"]})
        if not seller:
            raise HTTPException(status_code=404, detail="Seller profile not found")
        query = {"seller_id": seller["id"]}
    else:
        raise HTTPException(status_code=403, detail="Use the authorized admin return queue")
    
    requests = await db.return_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests

@api_router.get("/admin/return-requests")
async def list_admin_return_requests(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    request_type: Optional[Literal["return", "replacement", "cancel"]] = None,
    page: int = Query(default=1, ge=1), page_size: int = Query(default=25, ge=1, le=100),
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN])),
):
    query: Dict[str, Any] = {}
    if status_filter:
        if status_filter not in {"pending", "approved", "rejected", "pickup_scheduled", "received", "completed", "cancelled"}:
            raise HTTPException(status_code=422, detail="Invalid return status")
        query["status"] = status_filter
    if request_type:
        query["request_type"] = request_type
    total = await db.return_requests.count_documents(query)
    items = await db.return_requests.find(query, {"_id": 0}).sort("created_at", -1).skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size, "pages": (total + page_size - 1) // page_size}

@api_router.put("/return-requests/{request_id}/status")
async def update_return_request_status(
    request_id: str,
    payload: ReturnRequestStatusUpdate,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN])),
):
    """Apply a validated administrative return transition and synchronize the order."""
    permissions = set(user.get("permissions", []))
    if "*" not in permissions and "orders.manage" not in permissions:
        raise HTTPException(status_code=403, detail="Order management permission required")
    request = await db.return_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    current = request.get("status", "pending")
    transitions = {
        "pending": {"approved", "rejected", "cancelled"},
        "approved": {"pickup_scheduled", "received", "cancelled"},
        "pickup_scheduled": {"received", "cancelled"},
        "received": {"completed"},
    }
    if payload.status == current:
        return request
    if payload.status not in transitions.get(current, set()):
        raise HTTPException(status_code=409, detail=f"Cannot move request from {current} to {payload.status}")
    if payload.status == "received" and not payload.inventory_disposition:
        raise HTTPException(status_code=422, detail="Received returns require an inventory disposition")
    order = await db.orders.find_one({"id": request["order_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=409, detail="The related order no longer exists")
    now = datetime.now(timezone.utc)
    order_status = None
    if request["request_type"] == "cancel" and payload.status == "approved":
        order_status = OrderStatus.CANCELLED
    elif request["request_type"] != "cancel":
        order_status = {
            "approved": OrderStatus.RETURN_APPROVED,
            "rejected": OrderStatus.RETURN_REJECTED,
            "pickup_scheduled": OrderStatus.PICKUP_SCHEDULED,
            "received": OrderStatus.RETURNED,
            "cancelled": OrderStatus.DELIVERED,
        }.get(payload.status)

    async def persist(session=None):
        session_kwargs = {"session": session} if session is not None else {}
        if order_status == OrderStatus.CANCELLED:
            await _release_order_inventory(order, session=session)
        request_update: Dict[str, Any] = {"$set": {
            "status": payload.status, "admin_remarks": payload.admin_remarks, "updated_at": now,
        }, "$push": {
            "status_history": {"status": payload.status, "at": now, "actor_id": user["id"], "source": "admin"},
        }}
        if payload.status in {"rejected", "cancelled", "completed"}:
            request_update["$unset"] = {"active_key": ""}
        request_result = await db.return_requests.update_one(
            {"id": request_id, "status": current},
            request_update, **session_kwargs,
        )
        if request_result.modified_count != 1:
            raise HTTPException(status_code=409, detail="Return request changed; reload and retry")
        if payload.status == "received":
            for item in request.get("item_snapshot", []):
                quantity = int(item["quantity"])
                if item.get("inventory_kind") == "variant":
                    if payload.inventory_disposition == "restock":
                        inventory_update = {"$inc": {"stock_quantity": quantity, "available_quantity": quantity}}
                        movement_type = "return_restock"
                    else:
                        inventory_update = {"$inc": {"damaged_quantity": quantity}}
                        movement_type = "return_damaged"
                    await db.variant_inventory.update_one({"variant_id": item["variant_id"]}, inventory_update, **session_kwargs)
                else:
                    if payload.inventory_disposition == "restock":
                        inventory_update = {"$inc": {"quantity": quantity}}
                        movement_type = "return_restock"
                    else:
                        inventory_update = {"$inc": {"damaged_quantity": quantity}}
                        movement_type = "return_damaged"
                    await db.inventory.update_one({"product_id": item["product_id"]}, inventory_update, **session_kwargs)
                await record_inventory_movement(
                    product_id=item["product_id"], variant_id=item.get("variant_id"), seller_id=item["seller_id"],
                    movement_type=movement_type, quantity=quantity, order_id=order["id"], actor_id=user["id"],
                    reason=f"Return received: {payload.inventory_disposition}", session=session,
                )
            await db.return_requests.update_one(
                {"id": request_id}, {"$set": {"inventory_disposition": payload.inventory_disposition, "inventory_disposition_at": now}},
                **session_kwargs,
            )
        if order_status:
            await db.orders.update_one(
                {"id": order["id"]},
                {"$set": {"status": order_status.value, "updated_at": now}, "$push": {
                    "status_history": {"status": order_status.value, "at": now, "actor_id": user["id"], "source": "return_workflow"},
                }}, **session_kwargs,
            )
        notification = Notification(
            user_id=request["customer_id"], title=f"{request['request_type'].capitalize()} request {payload.status}",
            message=f"Your request for order #{request['order_id']} is now {payload.status}", type="return_update",
        )
        await db.notifications.insert_one({**notification.model_dump(), "return_request_id": request_id}, **session_kwargs)
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()), "actor_id": user["id"], "action": "return_request.status_changed",
            "target_id": request_id, "order_id": request["order_id"], "before": current,
            "after": payload.status, "created_at": now,
        }, **session_kwargs)
    if USE_MOCK_DB:
        await persist()
    else:
        async with await client.start_session() as mongo_session:
            async with mongo_session.start_transaction():
                await persist(mongo_session)
    return await db.return_requests.find_one({"id": request_id}, {"_id": 0})

# ============== TICKET SYSTEM APIS ==============
@api_router.post("/tickets")
async def create_ticket(
    ticket_data: TicketCreate,
    user: Dict[str, Any] = Depends(require_role([UserRole.CUSTOMER]))
):
    """Customer creates support ticket"""
    ticket = Ticket(
        customer_id=user["id"],
        customer_name=user["name"],
        **ticket_data.model_dump()
    )
    await db.tickets.insert_one(ticket.model_dump())
    return ticket

@api_router.get("/tickets/my")
async def get_my_tickets(user: Dict[str, Any] = Depends(require_role([UserRole.CUSTOMER]))):
    """Get customer's tickets"""
    tickets = await db.tickets.find(
        {"customer_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return tickets

@api_router.get("/admin/tickets")
async def get_all_tickets(
    status: Optional[str] = None,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Admin views all tickets"""
    query = {}
    if status:
        query["status"] = status
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return tickets

@api_router.put("/admin/tickets/{ticket_id}/status")
async def update_ticket_status(
    ticket_id: str,
    status: str,
    assigned_to: Optional[str] = None,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Admin updates ticket status"""
    update_data = {
        "status": status,
        "updated_at": datetime.now(timezone.utc)
    }
    if assigned_to:
        update_data["assigned_to"] = assigned_to
    
    await db.tickets.update_one({"id": ticket_id}, {"$set": update_data})
    return {"message": "Ticket updated"}

@api_router.post("/admin/tickets/{ticket_id}/respond")
async def respond_to_ticket(
    ticket_id: str,
    message: str,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Admin responds to ticket"""
    response = TicketResponse(
        ticket_id=ticket_id,
        responder_id=user["id"],
        responder_name=user["name"],
        message=message
    )
    await db.ticket_responses.insert_one(response.model_dump())
    
    # Update ticket status
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {"status": "in_progress", "updated_at": datetime.now(timezone.utc)}}
    )
    
    return response

@api_router.get("/tickets/{ticket_id}/responses")
async def get_ticket_responses(ticket_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    """Get all responses for a ticket"""
    responses = await db.ticket_responses.find(
        {"ticket_id": ticket_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    return responses

# ============== SELLER STORE APIS ==============
@api_router.get("/stores/{seller_id}")
async def get_seller_store(seller_id: str):
    """Get seller's store details"""
    store = await db.seller_stores.find_one({"seller_id": seller_id}, {"_id": 0})
    if not store:
        seller = await db.sellers.find_one({"id": seller_id}, {"_id": 0})
        if seller:
            store = SellerStore(
                seller_id=seller_id,
                store_name=seller["business_name"]
            ).model_dump()
    
    # Get store products
    products = await db.products.find(
        {"seller_id": seller_id, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    return {"store": store, "products": products}

@api_router.put("/stores/my")
async def update_my_store(
    updates: SellerStoreUpdate,
    user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))
):
    """Seller updates store details"""
    seller = await db.sellers.find_one({"user_id": user["id"]})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.seller_stores.update_one(
        {"seller_id": seller["id"]},
        {"$set": update_data},
        upsert=True
    )
    
    store = await db.seller_stores.find_one({"seller_id": seller["id"]}, {"_id": 0})
    return store

# ============== FOOTER CONTENT APIS ==============
@api_router.get("/footer-content")
async def get_footer_content():
    """Get footer content"""
    content = await db.footer_content.find_one({"id": "footer_content"}, {"_id": 0})
    if not content:
        content = FooterContent().model_dump()
        await db.footer_content.insert_one(dict(content))
    return content

@api_router.put("/admin/footer-content")
async def update_footer_content(
    updates: FooterContentUpdate,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Admin updates footer content"""
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.footer_content.update_one(
        {"id": "footer_content"},
        {"$set": update_data},
        upsert=True
    )
    
    content = await db.footer_content.find_one({"id": "footer_content"}, {"_id": 0})
    return content

# ============== OFFER CARDS APIS ==============
@api_router.get("/offer-cards")
async def get_offer_cards():
    """Get active offer cards"""
    offers = await db.offer_cards.find(
        {"is_active": True},
        {"_id": 0}
    ).sort("display_order", 1).to_list(10)
    return offers

@api_router.post("/admin/offer-cards")
async def create_offer_card(
    offer_data: OfferCardCreate,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Admin creates offer card"""
    offer = OfferCard(**offer_data.model_dump())
    await db.offer_cards.insert_one(offer.model_dump())
    return offer

@api_router.delete("/admin/offer-cards/{offer_id}")
async def delete_offer_card(
    offer_id: str,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Admin deletes offer card"""
    await db.offer_cards.delete_one({"id": offer_id})
    return {"message": "Offer card deleted"}

# ============== CREATOR CAMPAIGN APIS ==============
@api_router.get("/creator-campaigns")
async def get_creator_campaigns(visitor_id: Optional[str] = None):
    campaigns = await db.creator_campaigns.find({"is_active": True}, {"_id": 0}).sort("display_order", 1).to_list(50)
    for campaign in campaigns:
        campaign_id = campaign["id"]
        campaign["likes"] = await db.creator_campaign_events.count_documents({"campaign_id": campaign_id, "event_type": "like", "active": True})
        campaign["liked_by_visitor"] = bool(visitor_id and await db.creator_campaign_events.find_one({"campaign_id": campaign_id, "visitor_id": visitor_id, "event_type": "like", "active": True}))
    return sorted(campaigns, key=lambda item: (-int(item.get("likes", 0)), int(item.get("display_order", 0)), item.get("created_at")))

@api_router.post("/creator-campaigns/{campaign_id}/events")
async def track_creator_campaign_event(campaign_id: str, payload: CampaignEventCreate):
    if not await db.creator_campaigns.find_one({"id": campaign_id, "is_active": True}):
        raise HTTPException(status_code=404, detail="Campaign not found")
    now = datetime.now(timezone.utc)
    identity = {"campaign_id": campaign_id, "visitor_id": payload.visitor_id, "event_type": payload.event_type}
    if payload.event_type == "like":
        existing = await db.creator_campaign_events.find_one(identity)
        active = not bool(existing and existing.get("active", True))
        await db.creator_campaign_events.update_one(identity, {"$set": {**identity, "active": active, "source": payload.source, "referrer": payload.referrer, "updated_at": now}, "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": now}}, upsert=True)
        return {"liked": active}
    # De-duplicate impressions/clicks per visitor and campaign to keep analytics meaningful.
    await db.creator_campaign_events.update_one(identity, {"$setOnInsert": {"id": str(uuid.uuid4()), **identity, "active": True, "source": payload.source, "referrer": payload.referrer, "created_at": now}}, upsert=True)
    return {"tracked": True}

@api_router.post("/admin/creator-campaigns")
async def create_creator_campaign(payload: CreatorCampaignCreate, user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))):
    campaign = CreatorCampaign(**payload.model_dump())
    await db.creator_campaigns.insert_one(campaign.model_dump())
    return campaign

@api_router.delete("/admin/creator-campaigns/{campaign_id}")
async def delete_creator_campaign(campaign_id: str, user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))):
    result = await db.creator_campaigns.update_one({"id": campaign_id}, {"$set": {"is_active": False}})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"message": "Campaign archived"}

@api_router.get("/admin/analytics/creator-campaigns")
async def creator_campaign_analytics(user: Dict[str, Any] = Depends(require_super_admin)):
    campaigns = await db.creator_campaigns.find({}, {"_id": 0}).sort("display_order", 1).to_list(200)
    rows = []
    for campaign in campaigns:
        events = await db.creator_campaign_events.find({"campaign_id": campaign["id"], "active": True}, {"_id": 0}).to_list(100000)
        views = sum(event.get("event_type") == "view" for event in events)
        clicks = sum(event.get("event_type") == "click" for event in events)
        likes = sum(event.get("event_type") == "like" for event in events)
        rows.append({**campaign, "views": views, "clicks": clicks, "likes": likes, "ctr": round((clicks / views * 100), 2) if views else 0})
    channel_totals = {}
    for row in rows:
        channel = row.get("social_channel", "other")
        totals = channel_totals.setdefault(channel, {"channel": channel, "views": 0, "clicks": 0, "likes": 0})
        for metric in ("views", "clicks", "likes"):
            totals[metric] += row[metric]
    return {"campaigns": rows, "channels": list(channel_totals.values())}

# ============== BANK OFFERS APIS ==============
@api_router.get("/bank-offers")
async def get_bank_offers():
    """Get active bank offers"""
    now = datetime.now(timezone.utc)
    offers = await db.bank_offers.find(
        {"is_active": True, "valid_until": {"$gte": now}},
        {"_id": 0}
    ).to_list(100)
    return offers

@api_router.post("/admin/bank-offers")
async def create_bank_offer(
    offer_data: BankOfferCreate,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Admin creates bank offer"""
    offer = BankOffer(**offer_data.model_dump())
    await db.bank_offers.insert_one(offer.model_dump())
    return offer

@api_router.delete("/admin/bank-offers/{offer_id}")
async def delete_bank_offer(
    offer_id: str,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Admin deletes bank offer"""
    await db.bank_offers.delete_one({"id": offer_id})
    return {"message": "Bank offer deleted"}

# ============== PROFILE PICTURE UPLOAD API ==============
@api_router.put("/profile/picture")
async def update_profile_picture(
    profile_picture: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Update user profile picture"""
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"profile_picture": profile_picture}}
    )
    return {"message": "Profile picture updated", "profile_picture": profile_picture}

@api_router.put("/profile/bio")
async def update_profile_bio(
    bio: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Update user bio"""
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"bio": bio}}
    )
    return {"message": "Bio updated", "bio": bio}

# ============== PLATFORM SETTINGS APIS ==============
@api_router.get("/platform-settings")
async def get_platform_settings():
    """Get platform settings"""
    settings = await db.platform_settings.find_one({"id": "platform_settings"}, {"_id": 0})
    if not settings:
        settings = PlatformSettings().model_dump()
        await db.platform_settings.insert_one(settings)
        settings = await db.platform_settings.find_one({"id": "platform_settings"}, {"_id": 0})
    
    # Convert datetime to ISO string for JSON serialization
    if settings and "updated_at" in settings:
        if hasattr(settings["updated_at"], "isoformat"):
            settings["updated_at"] = settings["updated_at"].isoformat()
    
    return settings

@api_router.put("/admin/platform-settings")
async def update_platform_settings(
    updates: PlatformSettingsUpdate,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Admin updates platform settings"""
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.platform_settings.update_one(
        {"id": "platform_settings"},
        {"$set": update_data},
        upsert=True
    )
    
    settings = await db.platform_settings.find_one({"id": "platform_settings"}, {"_id": 0})
    
    # Convert datetime to ISO string for JSON serialization
    if settings and "updated_at" in settings:
        if hasattr(settings["updated_at"], "isoformat"):
            settings["updated_at"] = settings["updated_at"].isoformat()
    
    return settings

# ============== SELLER PAYOUT APIS ==============
@api_router.get("/admin/seller-payouts")
async def get_seller_payouts(
    status: Optional[str] = None,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Admin views seller payouts"""
    query = {}
    if status:
        query["status"] = status
    
    payouts = await db.seller_payouts.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return payouts

@api_router.post("/admin/generate-payouts")
async def generate_payouts(user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))):
    """Generate weekly payouts for all sellers"""
    settings = await db.platform_settings.find_one({"id": "platform_settings"})
    if not settings:
        settings = PlatformSettings().model_dump()
    
    # Get date range (last week)
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=settings["payment_cycle_days"])
    
    # Get all sellers
    sellers = await db.sellers.find({}, {"_id": 0}).to_list(1000)
    
    payouts_created = []
    for seller in sellers:
        # Get orders for this seller in the period
        orders = await db.orders.find({
            "items.seller_id": seller["id"],
            "status": "delivered",
            "created_at": {"$gte": start_date, "$lte": end_date}
        }).to_list(1000)
        
        if not orders:
            continue
        
        # Calculate amounts
        gross_amount = 0
        for order in orders:
            seller_items = [item for item in order["items"] if item.get("seller_id") == seller["id"]]
            gross_amount += sum([item["price"] * item["quantity"] for item in seller_items])
        
        platform_fee = round((gross_amount * settings["platform_fee_percentage"]) / 100, 2)
        promotion_fee = round((gross_amount * settings["promotion_fee_percentage"]) / 100, 2)
        net_payout = round(gross_amount - platform_fee - promotion_fee, 2)
        
        payout = SellerPayout(
            seller_id=seller["id"],
            period_start=start_date,
            period_end=end_date,
            total_orders=len(orders),
            gross_amount=gross_amount,
            platform_fee=platform_fee,
            promotion_fee=promotion_fee,
            net_payout=net_payout
        )
        
        await db.seller_payouts.insert_one(payout.model_dump())
        payouts_created.append(payout.model_dump())
    
    return {"message": f"Generated {len(payouts_created)} payouts", "payouts": payouts_created}

@api_router.put("/admin/seller-payouts/{payout_id}/process")
async def process_payout(
    payout_id: str,
    payment_reference: str,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Admin marks payout as processed"""
    await db.seller_payouts.update_one(
        {"id": payout_id},
        {"$set": {
            "status": "paid",
            "processed_at": datetime.now(timezone.utc),
            "payment_reference": payment_reference
        }}
    )
    return {"message": "Payout processed"}

# ============== SELLER PAYOUT APIS (SELLER VIEW) ==============
@api_router.get("/seller/payouts")
async def get_my_payouts(user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))):
    """Seller views their own payouts"""
    seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    payouts = await db.seller_payouts.find(
        {"seller_id": seller["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return payouts

@api_router.get("/seller/platform-fees")
async def get_my_platform_fees(user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))):
    """Seller views platform fees deducted from their orders"""
    seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    fees = await db.platform_fees.find(
        {"seller_id": seller["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    total_fees = sum(fee.get("fee_amount", 0) for fee in fees)
    total_payout = sum(fee.get("seller_payout", 0) for fee in fees)
    
    return {
        "fees": fees,
        "summary": {
            "total_orders": len(fees),
            "total_fee_amount": round(total_fees, 2),
            "total_seller_payout": round(total_payout, 2)
        }
    }

@api_router.get("/seller/earnings-summary")
async def get_seller_earnings_summary(user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))):
    """Seller views their earnings summary"""
    seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    # Get platform fees (order-wise earnings)
    fees = await db.platform_fees.find({"seller_id": seller["id"]}, {"_id": 0}).to_list(1000)
    total_earnings = sum(fee.get("seller_payout", 0) for fee in fees)
    total_platform_fee = sum(fee.get("fee_amount", 0) for fee in fees)
    
    # Get payouts
    payouts = await db.seller_payouts.find({"seller_id": seller["id"]}, {"_id": 0}).to_list(1000)
    total_paid = sum(p.get("net_payout", 0) for p in payouts if p.get("status") == "paid")
    pending_payout = total_earnings - total_paid
    
    return {
        "total_earnings": round(total_earnings, 2),
        "total_paid": round(total_paid, 2),
        "pending_payout": round(pending_payout, 2),
        "total_platform_fee": round(total_platform_fee, 2),
        "total_orders": len(fees)
    }

# ============== NOTIFICATION READ STATUS ==============
@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Mark notification as read"""
    await db.notifications.update_one(
        {"id": notification_id, "user_id": user["id"]},
        {"$set": {"is_read": True}}
    )
    return {"message": "Notification marked as read"}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(user: Dict[str, Any] = Depends(get_current_user)):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"user_id": user["id"]},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read"}

@api_router.delete("/notifications/my")
async def delete_all_my_notifications(user: Dict[str, Any] = Depends(get_current_user)):
    """Delete only the authenticated user's in-app notification history."""
    result = await db.notifications.delete_many({"user_id": user["id"]})
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()), "actor_id": user["id"],
        "action": "notifications.deleted_all", "entity_type": "notification",
        "deleted_count": result.deleted_count, "created_at": datetime.now(timezone.utc),
    })
    return {"message": "All notifications deleted", "deleted_count": result.deleted_count}

# ============== CATEGORY LIST API ==============
@api_router.get("/categories/list")
async def get_categories_list():
    """Get list of all categories"""
    return [
        "For Him",
        "For Her",
        "Unisex",
        "Home Scents",
        "Discovery Sets",
        "Gifting",
        "Sale",
        "New Arrivals",
        "Coming Soon",
    ]

# ============== STOREFRONT VISIBILITY APIS ==============
@api_router.get("/storefront-visibility")
async def get_storefront_visibility():
    """Get storefront visibility settings"""
    visibility = await db.storefront_visibility.find_one({"id": "storefront_visibility"}, {"_id": 0})
    if not visibility:
        visibility = StorefrontVisibility().model_dump()
        await db.storefront_visibility.insert_one(dict(visibility))
    return visibility

@api_router.put("/admin/storefront-visibility")
async def update_storefront_visibility(
    updates: StorefrontVisibilityUpdate,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Admin updates storefront visibility settings"""
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.storefront_visibility.update_one(
        {"id": "storefront_visibility"},
        {"$set": update_data},
        upsert=True
    )
    
    visibility = await db.storefront_visibility.find_one({"id": "storefront_visibility"}, {"_id": 0})
    return visibility

# ============== HERO BANNER APIS ==============
@api_router.get("/hero-banners")
async def get_hero_banners():
    """Get all active hero banners"""
    banners = await db.hero_banners.find(
        {"is_active": True}, 
        {"_id": 0}
    ).sort("display_order", 1).to_list(20)
    return banners

@api_router.get("/admin/hero-banners")
async def get_all_hero_banners(user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))):
    """Admin gets all hero banners"""
    banners = await db.hero_banners.find({}, {"_id": 0}).sort("display_order", 1).to_list(100)
    return banners

@api_router.post("/admin/hero-banners")
async def create_hero_banner(
    banner_data: HeroBannerCreate,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Admin creates a new hero banner"""
    banner = HeroBanner(**banner_data.model_dump())
    await db.hero_banners.insert_one(banner.model_dump())
    return banner

@api_router.put("/admin/hero-banners/{banner_id}")
async def update_hero_banner(
    banner_id: str,
    updates: HeroBannerUpdate,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Admin updates a hero banner"""
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    await db.hero_banners.update_one({"id": banner_id}, {"$set": update_data})
    banner = await db.hero_banners.find_one({"id": banner_id}, {"_id": 0})
    return banner

@api_router.delete("/admin/hero-banners/{banner_id}")
async def delete_hero_banner(
    banner_id: str,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Admin deletes a hero banner"""
    await db.hero_banners.delete_one({"id": banner_id})
    return {"message": "Banner deleted"}

# ============== SUPPORT SETTINGS APIS ==============
@api_router.get("/support-settings")
async def get_support_settings():
    """Get support settings"""
    settings = await db.support_settings.find_one({"id": "support_settings"}, {"_id": 0})
    if not settings:
        settings = SupportSettings().model_dump()
        await db.support_settings.insert_one(settings)
    return settings

@api_router.put("/admin/support-settings")
async def update_support_settings(
    updates: SupportSettingsUpdate,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Admin updates support settings"""
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.support_settings.update_one(
        {"id": "support_settings"},
        {"$set": update_data},
        upsert=True
    )
    
    settings = await db.support_settings.find_one({"id": "support_settings"}, {"_id": 0})
    return settings

# ============== BESTSELLERS API (Auto-updated based on orders) ==============
@api_router.get("/products/bestsellers")
async def get_bestseller_products(limit: int = 10):
    """Get bestseller products based on order count"""
    # Aggregate orders to find most ordered products
    pipeline = [
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id", "order_count": {"$sum": "$items.quantity"}}},
        {"$sort": {"order_count": -1}},
        {"$limit": limit}
    ]
    
    bestseller_ids = []
    async for doc in db.orders.aggregate(pipeline):
        bestseller_ids.append(doc["_id"])
    
    products = []
    for product_id in bestseller_ids:
        product = await db.products.find_one({"id": product_id, "is_active": True}, {"_id": 0})
        if product:
            products.append(product)
    
    # If not enough products from orders, fill with random active products
    if len(products) < limit:
        additional = await db.products.find(
            {"is_active": True, "id": {"$nin": [p["id"] for p in products]}},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit - len(products)).to_list(limit - len(products))
        products.extend(additional)
    
    return [public_product(product) for product in products]

# ============== TICKER MESSAGE MANAGEMENT ==============
@api_router.get("/admin/ticker-messages")
async def get_all_ticker_messages(user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))):
    """Admin gets all ticker messages"""
    messages = await db.ticker_messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return messages

@api_router.put("/admin/ticker/{ticker_id}")
async def update_ticker_message(
    ticker_id: str,
    message: str,
    is_active: bool = True,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Admin updates a ticker message"""
    await db.ticker_messages.update_one(
        {"id": ticker_id},
        {"$set": {"message": message, "is_active": is_active}}
    )
    return {"message": "Ticker updated"}

@api_router.delete("/admin/ticker/{ticker_id}")
async def delete_ticker_message(
    ticker_id: str,
    user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))
):
    """Admin deletes a ticker message"""
    await db.ticker_messages.delete_one({"id": ticker_id})
    return {"message": "Ticker deleted"}


# ============== PRIVACY AND CONSENT ==============
def default_consent_config() -> Dict[str, Any]:
    return {
        "id": "consent_policy", "consent_policy_version": CONSENT_POLICY_VERSION,
        "cookie_policy_version": COOKIE_POLICY_VERSION, "privacy_policy_version": PRIVACY_POLICY_VERSION,
        "consent_expiry_days": CONSENT_EXPIRY_DAYS, "gpc_support": GPC_SUPPORT,
        "enabled_categories": ["functional", "analytics", "marketing", "personalization"],
        "banner_title": "Your privacy, your choice",
        "banner_description": "We use necessary technology to run Perfurm. Optional technology helps with preferences, measurement and relevant offers only when you allow it.",
        "updated_at": datetime.now(timezone.utc), "published_at": datetime.now(timezone.utc),
    }

async def effective_consent_config() -> Dict[str, Any]:
    return await db.consent_policy.find_one({"id": "consent_policy"}, {"_id": 0}) or default_consent_config()

async def optional_request_user(request: Request) -> Optional[Dict[str, Any]]:
    authorization = request.headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        return None
    try:
        payload = jwt.decode(authorization[7:], SECRET_KEY, algorithms=[ALGORITHM])
        return await db.users.find_one({"id": payload.get("sub"), "is_active": True}, {"_id": 0, "password_hash": 0})
    except JWTError:
        return None

@api_router.get("/privacy/consent/config")
async def get_consent_config():
    config = await effective_consent_config()
    return {**config, "necessary": {"enabled": True, "mutable": False}}

@api_router.post("/privacy/consent", status_code=201)
async def record_consent(payload: ConsentRecordCreate, request: Request):
    config = await effective_consent_config()
    expected = (config["consent_policy_version"], config["cookie_policy_version"], config["privacy_policy_version"])
    supplied = (payload.consent_policy_version, payload.cookie_policy_version, payload.privacy_policy_version)
    if supplied != expected:
        raise HTTPException(status_code=409, detail="Consent policy changed; review the current preferences")
    user = await optional_request_user(request)
    now = datetime.now(timezone.utc)
    record = {
        "id": str(uuid.uuid4()), "user_id": user.get("id") if user else None,
        "anonymous_id_hash": privacy_key(payload.anonymous_id) if payload.anonymous_id else None,
        "preferences": payload.preferences.model_dump(), "source": payload.source,
        "consent_policy_version": supplied[0], "cookie_policy_version": supplied[1],
        "privacy_policy_version": supplied[2], "created_at": now,
        "expires_at": now + timedelta(days=config["consent_expiry_days"]),
        "user_agent_hash": privacy_key(request.headers.get("User-Agent", "unknown")[:300]),
    }
    await db.consent_records.insert_one(record.copy())
    subject = {"user_id": record["user_id"]} if record["user_id"] else {"anonymous_id_hash": record["anonymous_id_hash"]}
    if subject.get(next(iter(subject))) is not None:
        await db.consent_current.update_one(subject, {"$set": record}, upsert=True)
    record.pop("anonymous_id_hash", None)
    record.pop("user_agent_hash", None)
    return {k: v for k, v in record.items() if k != "_id"}

@api_router.get("/privacy/consent/me")
async def get_my_consent(user: Dict[str, Any] = Depends(get_current_user)):
    record = await db.consent_current.find_one({"user_id": user["id"]}, {"_id": 0, "anonymous_id_hash": 0, "user_agent_hash": 0})
    return record or {"preferences": None}

@api_router.get("/admin/privacy/consent/config")
async def admin_get_consent_config(user: Dict[str, Any] = Depends(require_role([UserRole.ADMIN]))):
    return await effective_consent_config()

@api_router.put("/admin/privacy/consent/config")
async def publish_consent_config(payload: ConsentPolicyUpdate, user: Dict[str, Any] = Depends(require_super_admin)):
    current = await effective_consent_config()
    now = datetime.now(timezone.utc)
    await db.consent_policy_history.insert_one({**current, "archived_at": now, "archived_by": user["id"]})
    revision = int(str(current["consent_policy_version"]).rsplit(".", 1)[-1]) + 1
    update = {**current, **payload.model_dump(), "consent_policy_version": f"{datetime.now(timezone.utc).date()}.{revision}", "updated_at": now, "published_at": now, "published_by": user["id"]}
    await db.consent_policy.replace_one({"id": "consent_policy"}, update, upsert=True)
    await db.audit_logs.insert_one({"id": str(uuid.uuid4()), "actor_id": user["id"], "action": "privacy.consent_policy.publish", "target_id": "consent_policy", "created_at": now})
    return {k: v for k, v in update.items() if k != "_id"}

@api_router.get("/admin/privacy/consent/history")
async def consent_policy_history(user: Dict[str, Any] = Depends(require_super_admin)):
    return await db.consent_policy_history.find({}, {"_id": 0}).sort("archived_at", -1).limit(50).to_list(50)

# Include the router
app.include_router(api_router)

@app.get("/health", include_in_schema=False)
async def health_check():
    try:
        await db.command("ping")
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return {"status": "ok", "service": "perfurm-api", "environment": APP_ENV}


@app.get("/ready", include_in_schema=False)
async def readiness_check():
    checks = {"database": False, "reservation_worker": False, "notification_worker": False, "notification_provider": True}
    try:
        await db.command("ping")
        checks["database"] = True
    except Exception:
        pass
    checks["reservation_worker"] = bool(reservation_reaper_task and not reservation_reaper_task.done())
    checks["notification_worker"] = bool(notification_outbox_task and not notification_outbox_task.done())
    if NOTIFICATION_DELIVERY_ENABLED:
        checks["notification_provider"] = notification_channel_configured("email") or notification_channel_configured("sms")
    ready = all(checks.values())
    if not ready:
        return JSONResponse(status_code=503, content={"status": "not_ready", "checks": checks})
    return {"status": "ready", "checks": checks}


@app.get("/metrics", include_in_schema=False)
async def metrics(request: Request):
    if APP_ENV in {"staging", "production"}:
        authorization = request.headers.get("Authorization", "")
        if not METRICS_TOKEN or not secrets.compare_digest(authorization, f"Bearer {METRICS_TOKEN}"):
            raise HTTPException(status_code=401, detail="Metrics authentication required")
    pending_jobs = await db.notification_jobs.count_documents({"status": "pending"})
    dead_jobs = await db.notification_jobs.count_documents({"status": "dead"})
    blocked_jobs = await db.notification_jobs.count_documents({"status": "blocked_configuration"})
    reserved_orders = await db.orders.count_documents({"reservation_status": "reserved"})
    lines = [
        "# HELP perfurm_uptime_seconds Process uptime.",
        "# TYPE perfurm_uptime_seconds gauge",
        f"perfurm_uptime_seconds {time.time() - request_metrics['started_at']:.3f}",
        "# HELP perfurm_http_requests_total HTTP responses by method and status.",
        "# TYPE perfurm_http_requests_total counter",
    ]
    for (method, status_code), count in sorted(request_metrics["requests_total"].items()):
        lines.append(f'perfurm_http_requests_total{{method="{method}",status="{status_code}"}} {count}')
    lines.extend([
        "# TYPE perfurm_http_request_duration_seconds_sum counter",
        f"perfurm_http_request_duration_seconds_sum {request_metrics['duration_seconds_sum']:.6f}",
        "# TYPE perfurm_http_request_duration_seconds_count counter",
        f"perfurm_http_request_duration_seconds_count {request_metrics['duration_seconds_count']}",
        "# TYPE perfurm_notification_jobs gauge",
        f'perfurm_notification_jobs{{status="pending"}} {pending_jobs}',
        f'perfurm_notification_jobs{{status="dead"}} {dead_jobs}',
        f'perfurm_notification_jobs{{status="blocked_configuration"}} {blocked_jobs}',
        "# TYPE perfurm_reserved_orders gauge",
        f"perfurm_reserved_orders {reserved_orders}",
    ])
    return Response(content="\n".join(lines) + "\n", media_type="text/plain; version=0.0.4")

@app.get("/sitemap.xml", include_in_schema=False)
async def sitemap():
    namespace = "http://www.sitemaps.org/schemas/sitemap/0.9"
    urlset = ET.Element("urlset", xmlns=namespace)

    def add_url(location: str, last_modified: Optional[Any] = None):
        node = ET.SubElement(urlset, "url")
        ET.SubElement(node, "loc").text = f"{PUBLIC_SITE_URL}{location}"
        if last_modified:
            value = last_modified.isoformat() if isinstance(last_modified, datetime) else str(last_modified)
            ET.SubElement(node, "lastmod").text = value[:10]

    add_url("/")
    categories = await db.products.distinct("category", {"is_active": True})
    from urllib.parse import quote
    for category in categories:
        add_url(f"/customer/category/{quote(category)}")
    products = await db.products.find(
        {"is_active": True}, {"_id": 0, "id": 1, "slug": 1, "updated_at": 1}
    ).to_list(100000)
    for product in products:
        add_url(f"/customer/product/{quote(product.get('slug') or product['id'])}", product.get("updated_at"))
    return Response(content=ET.tostring(urlset, encoding="unicode"), media_type="application/xml")

@app.get("/robots.txt", include_in_schema=False)
async def robots():
    content = f"User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /seller\nDisallow: /delivery\nDisallow: /customer/checkout\nSitemap: {PUBLIC_SITE_URL}/sitemap.xml\n"
    return Response(content=content, media_type="text/plain")

@app.exception_handler(HTTPException)
async def http_error_handler(request: Request, exc: HTTPException):
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "error": {"code": f"HTTP_{exc.status_code}", "message": exc.detail},
            "request_id": request_id,
        },
        headers=exc.headers,
    )

@app.middleware("http")
async def security_and_request_context(request: Request, call_next):
    request_started = time.perf_counter()
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.request_id = request_id
    path = request.url.path
    if request.method != "OPTIONS" and (path.startswith("/api/admin/") or path.startswith("/api/analytics/admin")):
        authorization = request.headers.get("Authorization", "")
        if authorization.startswith("Bearer "):
            try:
                payload = jwt.decode(authorization[7:], SECRET_KEY, algorithms=[ALGORITHM])
                scoped_user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0})
            except JWTError:
                scoped_user = None
            if scoped_user and scoped_user.get("role") == UserRole.ADMIN.value and scoped_user.get("admin_role") != "super_admin":
                required = required_admin_permission(path)
                permissions = scoped_user.get("permissions", [])
                if required not in permissions and "*" not in permissions:
                    return JSONResponse(
                        status_code=403,
                        content={
                            "detail": "Insufficient admin permission",
                            "error": {"code": "ADMIN_PERMISSION_REQUIRED", "message": "Insufficient admin permission", "required": required},
                            "request_id": request_id,
                        },
                        headers={
                            "X-Request-ID": request_id, "X-Content-Type-Options": "nosniff",
                            "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin",
                        },
                    )
    response = await call_next(request)
    elapsed = time.perf_counter() - request_started
    request_metrics["requests_total"][(request.method, response.status_code)] += 1
    request_metrics["duration_seconds_sum"] += elapsed
    request_metrics["duration_seconds_count"] += 1
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(self)"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
    if path.startswith("/api/auth/") or path.startswith("/api/admin/"):
        response.headers["Cache-Control"] = "no-store"
    if response.headers.get("content-type", "").startswith("text/html"):
        response.headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    if APP_ENV == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(','),
    allow_origin_regex=r"https://[a-z0-9-]+\.trycloudflare\.com" if APP_ENV == "development" else None,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

reservation_reaper_task: Optional[asyncio.Task] = None
notification_outbox_task: Optional[asyncio.Task] = None

async def reservation_reaper_loop() -> None:
    while True:
        try:
            released = await expire_stale_payment_reservations()
            if released:
                logger.info("Released %s expired payment reservations", released)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Payment reservation reaper failed")
        await asyncio.sleep(60)


async def notification_outbox_loop() -> None:
    while True:
        try:
            stale_claim = datetime.now(timezone.utc) - timedelta(minutes=5)
            await db.notification_jobs.update_many(
                {"status": "processing", "claimed_at": {"$lte": stale_claim}},
                {"$set": {"status": "pending", "next_attempt_at": datetime.now(timezone.utc)}},
            )
            await materialize_notification_outbox()
            await deliver_notification_jobs()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Notification outbox worker failed")
        await asyncio.sleep(5)

@app.on_event("shutdown")
async def shutdown_db_client():
    global reservation_reaper_task, notification_outbox_task
    tasks = [task for task in [reservation_reaper_task, notification_outbox_task] if task]
    for task in tasks:
        task.cancel()
    for task in tasks:
        try:
            await task
        except asyncio.CancelledError:
            pass
    reservation_reaper_task = None
    notification_outbox_task = None
    client.close()

@app.on_event("startup")
async def startup_db():
    global reservation_reaper_task, notification_outbox_task
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.products.create_index("seller_id")
    await db.products.create_index("sku", unique=True)
    if USE_MOCK_DB:
        # mongomock treats repeated explicit nulls as duplicate even on sparse indexes.
        await db.products.create_index("slug")
    else:
        await db.products.create_index(
            "slug", unique=True, partialFilterExpression={"slug": {"$type": "string"}}
        )
    await db.products.create_index([("is_active", 1), ("category", 1), ("price", 1)])
    await db.products.create_index([("is_active", 1), ("brand", 1), ("fragrance_family", 1)])
    await db.products.create_index([("is_active", 1), ("target_category", 1), ("concentration", 1)])
    await db.products.create_index([("is_active", 1), ("created_at", -1)])
    await db.inventory.create_index("product_id", unique=True)
    await db.variant_inventory.create_index("variant_id", unique=True)
    await db.variant_inventory.create_index("sku", unique=True)
    await db.variant_inventory.create_index([("product_id", 1), ("available_quantity", 1)])
    await db.inventory_movements.create_index([("seller_id", 1), ("created_at", -1)])
    await db.inventory_movements.create_index([("order_id", 1), ("created_at", 1)])
    await db.pincode_rules.create_index("pincode", unique=True)
    await db.orders.create_index("customer_id")
    await db.orders.create_index([("customer_id", 1), ("created_at", -1)])
    await db.orders.create_index("razorpay_order_id", sparse=True)
    await db.coupons.create_index("code", unique=True)
    await db.coupon_customer_usage.create_index([("coupon_id", 1), ("customer_id", 1)], unique=True)
    await db.customer_credits.create_index([("customer_id", 1), ("status", 1), ("created_at", -1)])
    await db.coupon_redemptions.create_index("order_id", unique=True)
    await db.coupon_redemptions.create_index([("coupon_id", 1), ("customer_id", 1), ("created_at", -1)])
    await db.return_requests.create_index("active_key", unique=True, sparse=True)
    await db.return_requests.create_index([("customer_id", 1), ("created_at", -1)])
    await db.return_requests.create_index([("seller_id", 1), ("status", 1), ("created_at", -1)])
    if USE_MOCK_DB:
        await db.orders.create_index([("customer_id", 1), ("idempotency_key", 1)])
    else:
        await db.orders.create_index(
            [("customer_id", 1), ("idempotency_key", 1)], unique=True,
            partialFilterExpression={"idempotency_key": {"$type": "string"}},
        )
    await db.payment_events.create_index("event_id", unique=True)
    await db.refunds.create_index("provider_refund_id", unique=True, sparse=True)
    await db.reviews.create_index("order_item_key", unique=True, sparse=True)
    await db.reviews.create_index([("moderation_status", 1), ("created_at", -1)])
    await db.reviews.create_index([("product_id", 1), ("moderation_status", 1), ("created_at", -1)])
    await db.review_helpful_votes.create_index("id", unique=True)
    await db.shipping_events.create_index("id", unique=True)
    await db.account_deletion_requests.create_index([("status", 1), ("requested_at", -1)])
    await db.account_deletion_requests.create_index([("user_id", 1), ("status", 1)])
    await db.invoices.create_index("invoice_number", unique=True)
    await db.invoices.create_index([("order_id", 1), ("seller_id", 1)], unique=True)
    await db.invoices.create_index([("customer_id", 1), ("issued_at", -1)])
    if USE_MOCK_DB:
        await db.refunds.create_index([("order_id", 1), ("idempotency_key", 1)])
    else:
        await db.refunds.create_index(
            [("order_id", 1), ("idempotency_key", 1)], unique=True,
            partialFilterExpression={"idempotency_key": {"$type": "string"}},
        )
    await db.auth_sessions.create_index("token_hash", unique=True)
    await db.auth_sessions.create_index([("user_id", 1), ("expires_at", -1)])
    await db.auth_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.auth_challenges.create_index("key", unique=True)
    await db.auth_challenges.create_index("expires_at", expireAfterSeconds=0)
    await db.rate_limits.create_index([("key", 1), ("window", 1)], unique=True)
    await db.rate_limits.create_index("expires_at", expireAfterSeconds=0)
    await db.notifications.create_index("user_id")
    await db.notifications.create_index([("outbox_state", 1), ("created_at", 1)])
    await db.notification_jobs.create_index([("notification_id", 1), ("channel", 1)], unique=True)
    await db.notification_jobs.create_index([("status", 1), ("next_attempt_at", 1)])
    if USE_MOCK_DB and await db.users.count_documents({}) == 0:
        now = datetime.now(timezone.utc)
        preview_users = [
            User(id="preview-admin-user", email="admin@perfurm.com", password_hash=hash_password("admin123"), role=UserRole.ADMIN, name="Perfurm Admin", phone="9000000001", created_at=now, admin_role="super_admin", permissions=["*"]).model_dump(),
            User(id="preview-seller-user", email="seller1@example.com", password_hash=hash_password("seller123"), role=UserRole.SELLER, name="Atelier Fragrance Curator", phone="9000000002", created_at=now).model_dump(),
            User(id="preview-customer-user", email="customer@example.com", password_hash=hash_password("customer123"), role=UserRole.CUSTOMER, name="Preview Customer", phone="9000000003", created_at=now).model_dump(),
            User(id="preview-delivery-user", email="delivery@example.com", password_hash=hash_password("delivery123"), role=UserRole.DELIVERY_PARTNER, name="Preview Delivery Partner", phone="9000000004", created_at=now).model_dump(),
        ]
        await db.users.insert_many(preview_users)
        await db.sellers.insert_one(Seller(
            id="preview-atelier",
            user_id="preview-seller-user",
            business_name="Atelier No. 9",
            business_email="seller1@example.com",
            business_phone="9000000002",
            gst_number="PREVIEWGST01",
            address="123 Garden Lane",
            city="Mumbai",
            state="Maharashtra",
            pincode="400001",
            status=SellerStatus.APPROVED,
            created_at=now,
            approved_at=now,
            approved_by="preview-admin-user",
        ).model_dump())
        await db.delivery_partners.insert_one(DeliveryPartner(
            id="preview-delivery-partner",
            user_id="preview-delivery-user",
            company_name="Perfurm Local Delivery",
            contact_person="Preview Delivery Partner",
            contact_number="9000000004",
            email="delivery@example.com",
            service_areas=["Mumbai", "400001"],
            vehicle_types=["bike"],
            created_at=now,
        ).model_dump())
        logger.info("Loaded Perfurm preview accounts")
    if USE_MOCK_DB and await db.products.count_documents({}) == 0:
        now = datetime.now(timezone.utc)
        preview_products = [
            Product(seller_id="preview-atelier", name="Velvet Oud Eau de Parfum", description="A deep oud softened by rose absolute and warm amber.", category="For Him", price=2890, mrp=3490, sku="PFM001", images=["https://images.unsplash.com/photo-1541643600914-78b084683601?w=800"], specifications={"Notes": "Oud, rose, amber", "Concentration": "Eau de Parfum"}, sizes=["10 ml", "50 ml", "100 ml"], created_at=now, updated_at=now).model_dump(),
            Product(seller_id="preview-atelier", name="Rose After Rain", description="Dewy petals, pink pepper and clean musk with a luminous finish.", category="For Her", price=2490, mrp=2990, sku="PFM002", images=["https://images.unsplash.com/photo-1594035910387-fea47794261f?w=800"], specifications={"Notes": "Rose, pink pepper, white musk", "Concentration": "Eau de Parfum"}, sizes=["10 ml", "50 ml", "100 ml"], created_at=now, updated_at=now).model_dump(),
            Product(seller_id="preview-studio", name="The Signature Discovery Set", description="Six fragrances spanning citrus, floral, woods, amber, musk and oud.", category="Discovery Sets", price=1190, mrp=1490, sku="PFM003", images=["https://images.unsplash.com/photo-1588405748880-12d1d2a59f75?w=800"], specifications={"Includes": "6 × 2 ml", "Format": "Spray vials"}, sizes=["6 × 2 ml"], created_at=now, updated_at=now).model_dump(),
            Product(seller_id="preview-studio", name="Salt Skin Eau de Parfum", description="Mineral air, bergamot and sun-warmed skin in an effortless unisex scent.", category="Unisex", price=2690, mrp=3290, sku="PFM004", images=["https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800"], specifications={"Notes": "Bergamot, sea salt, ambrette", "Concentration": "Eau de Parfum"}, sizes=["10 ml", "50 ml"], created_at=now, updated_at=now).model_dump(),
            Product(seller_id="preview-atelier", name="Midnight Saffron", description="Saffron, black rose and smoked vanilla for evenings that linger.", category="For Her", price=3290, mrp=3890, sku="PFM005", images=["https://images.unsplash.com/photo-1610461888750-10bfc601b874?w=800"], specifications={"Notes": "Saffron, black rose, smoked vanilla", "Concentration": "Eau de Parfum"}, sizes=["10 ml", "50 ml", "100 ml"], created_at=now, updated_at=now).model_dump(),
            Product(seller_id="preview-atelier", name="Atlas Cedar", description="Dry cedar, green cardamom and leather shaped into a confident signature.", category="For Him", price=3090, mrp=3690, sku="PFM006", images=["https://images.unsplash.com/photo-1615634260167-c8cdede054de?w=800"], specifications={"Notes": "Cedar, cardamom, leather", "Concentration": "Eau de Parfum"}, sizes=["10 ml", "50 ml", "100 ml"], created_at=now, updated_at=now).model_dump(),
            Product(seller_id="preview-studio", name="Neroli Sun", description="Sparkling neroli, mandarin peel and pale woods in a bright daily scent.", category="Unisex", price=2390, mrp=2890, sku="PFM007", images=["https://images.unsplash.com/photo-1595425970377-c9703cf48b6d?w=800"], specifications={"Notes": "Neroli, mandarin, pale woods", "Concentration": "Eau de Toilette"}, sizes=["30 ml", "75 ml"], created_at=now, updated_at=now).model_dump(),
            Product(seller_id="preview-atelier", name="Fig & Cashmere", description="Ripe fig wrapped in iris, sandalwood and a soft cashmere accord.", category="For Her", price=2790, mrp=3390, sku="PFM008", images=["https://images.unsplash.com/photo-1591375372226-3531cf2ebc6e?w=800"], specifications={"Notes": "Fig, iris, sandalwood", "Concentration": "Eau de Parfum"}, sizes=["10 ml", "50 ml"], created_at=now, updated_at=now).model_dump(),
            Product(seller_id="preview-studio", name="After Hours", description="Dark rum, tobacco leaf and tonka with a polished amber drydown.", category="For Him", price=3490, mrp=4190, sku="PFM009", images=["https://images.unsplash.com/photo-1563170351-be82bc888aa4?w=800"], specifications={"Notes": "Rum, tobacco, tonka", "Concentration": "Extrait de Parfum"}, sizes=["10 ml", "50 ml"], created_at=now, updated_at=now).model_dump(),
            Product(seller_id="preview-atelier", name="White Tea Veil", description="White tea, pear blossom and sheer musk with a clean, weightless trail.", category="For Her", price=2190, mrp=2690, sku="PFM010", images=["https://images.unsplash.com/photo-1594035910387-fea47794261f?w=800"], specifications={"Notes": "White tea, pear blossom, musk", "Concentration": "Eau de Parfum"}, sizes=["30 ml", "75 ml"], created_at=now, updated_at=now).model_dump(),
            Product(seller_id="preview-studio", name="Monsoon Vetiver", description="Rain-soaked earth, vetiver root and lime leaf inspired by the first monsoon.", category="Unisex", price=2990, mrp=3590, sku="PFM011", images=["https://images.unsplash.com/photo-1590156561130-77d8a15f4583?w=800"], specifications={"Notes": "Vetiver, petrichor, lime leaf", "Concentration": "Eau de Parfum"}, sizes=["10 ml", "50 ml", "100 ml"], created_at=now, updated_at=now).model_dump(),
            Product(seller_id="preview-atelier", name="Cedar Ember Candle", description="Hand-poured soy wax scented with cedar, tobacco leaf and tonka bean.", category="Home Scents", price=1290, mrp=1590, sku="PFM012", images=["https://images.unsplash.com/photo-1603006905003-be475563bc59?w=800"], specifications={"Notes": "Cedar, tobacco, tonka", "Burn time": "45 hours"}, sizes=["220 g"], created_at=now, updated_at=now).model_dump(),
            Product(seller_id="preview-studio", name="Hinoki Tea Diffuser", description="A serene blend of hinoki wood, steamed tea and temple incense.", category="Home Scents", price=1890, mrp=2290, sku="PFM013", images=["https://images.unsplash.com/photo-1602874801006-e26a19c6b631?w=800"], specifications={"Notes": "Hinoki, green tea, incense", "Lasts": "Up to 12 weeks"}, sizes=["150 ml"], created_at=now, updated_at=now).model_dump(),
            Product(seller_id="preview-atelier", name="The Floral Discovery", description="Five expressive florals, from transparent jasmine to velvet rose.", category="Discovery Sets", price=990, mrp=1290, sku="PFM014", images=["https://images.unsplash.com/photo-1588405748880-12d1d2a59f75?w=800"], specifications={"Includes": "5 x 2 ml", "Format": "Spray vials"}, sizes=["5 x 2 ml"], created_at=now, updated_at=now).model_dump(),
            Product(seller_id="preview-studio", name="The Woods Discovery", description="A journey through cedar, sandalwood, vetiver, oud and smoky guaiac.", category="Discovery Sets", price=1090, mrp=1390, sku="PFM015", images=["https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800"], specifications={"Includes": "5 x 2 ml", "Format": "Spray vials"}, sizes=["5 x 2 ml"], created_at=now, updated_at=now).model_dump(),
            Product(seller_id="preview-atelier", name="Celebration Gift Ritual", description="A full-size signature scent, travel spray and candle in our keepsake box.", category="Gifting", price=4990, mrp=5890, sku="PFM016", images=["https://images.unsplash.com/photo-1610461888750-10bfc601b874?w=800"], specifications={"Includes": "50 ml fragrance, 10 ml travel spray, candle", "Presentation": "Gift box"}, sizes=["Gift set"], created_at=now, updated_at=now).model_dump(),
        ]
        await db.products.insert_many(preview_products)
        preview_facets = {
            "PFM001": ("Woody", "Men", "Eau de Parfum"), "PFM002": ("Floral", "Women", "Eau de Parfum"),
            "PFM003": ("Fresh", "Unisex", "Eau de Parfum"), "PFM004": ("Aquatic", "Unisex", "Eau de Parfum"),
            "PFM005": ("Amber", "Women", "Eau de Parfum"), "PFM006": ("Woody", "Men", "Eau de Parfum"),
            "PFM007": ("Citrus", "Unisex", "Eau de Toilette"), "PFM008": ("Gourmand", "Women", "Eau de Parfum"),
            "PFM009": ("Amber", "Men", "Parfum"), "PFM010": ("Fresh", "Women", "Eau de Parfum"),
            "PFM011": ("Woody", "Unisex", "Eau de Parfum"), "PFM012": ("Woody", "Unisex", "Home Fragrance"),
            "PFM013": ("Fresh", "Unisex", "Home Fragrance"), "PFM014": ("Floral", "Women", "Discovery Set"),
            "PFM015": ("Woody", "Unisex", "Discovery Set"), "PFM016": ("Amber", "Unisex", "Gift Set"),
        }
        for sku, (family, target, concentration) in preview_facets.items():
            preview_product = await db.products.find_one({"sku": sku}, {"_id": 0, "name": 1})
            await db.products.update_one({"sku": sku}, {"$set": {
                "brand": "Perfurm", "fragrance_family": family, "target_category": target,
                "slug": re.sub(r"[^a-z0-9]+", "-", preview_product["name"].lower()).strip("-"),
                "concentration": concentration, "is_new_arrival": sku in {"PFM007", "PFM008", "PFM011"},
                "is_coming_soon": sku in {"PFM015", "PFM016"},
                "is_bestseller": sku in {"PFM001", "PFM002", "PFM006"},
                "average_rating": 4.4 if sku in {"PFM001", "PFM002", "PFM006"} else 4.1,
                "review_count": 28 if sku in {"PFM001", "PFM002", "PFM006"} else 12,
            }})
        # Preview perfumes use genuine priced variants—not decorative size labels.
        # The 50 ml catalogue price is the anchor; smaller/larger bottles scale
        # predictably and checkout reads these same authoritative variant prices.
        size_price_factors = {10.0: 0.40, 30.0: 0.72, 50.0: 1.0, 75.0: 1.30, 100.0: 1.65}
        variant_inventory_records, variant_product_ids = [], set()
        for product in preview_products:
            parsed_sizes = []
            for size in product.get("sizes", []):
                size_match = re.fullmatch(r"(\d+(?:\.\d+)?)\s*ml", size.strip(), re.IGNORECASE)
                if size_match:
                    parsed_sizes.append(float(size_match.group(1)))
            if len(parsed_sizes) < 2:
                continue
            variants = []
            for size_ml in parsed_sizes:
                factor = size_price_factors.get(size_ml, max(size_ml / 50, 0.35))
                price = max(10.0, round(float(product["price"]) * factor / 10) * 10)
                mrp = max(price, round(float(product["mrp"]) * factor / 10) * 10)
                size_token = f"{size_ml:g}"
                variant = ProductVariant(
                    id=f"preview-{product['sku'].lower()}-{size_token}",
                    sku=f"{product['sku']}-{size_token}ML", size_ml=size_ml,
                    label=f"{size_token} ml", price=price, mrp=mrp,
                    stock_quantity=25, low_stock_limit=5, image=product.get("images", [None])[0],
                ).model_dump()
                variants.append(variant)
                variant_inventory_records.append(VariantInventory(
                    product_id=product["id"], variant_id=variant["id"], seller_id=product["seller_id"],
                    sku=variant["sku"], stock_quantity=25, available_quantity=25,
                ).model_dump())
            variant_product_ids.add(product["id"])
            await db.products.update_one({"id": product["id"]}, {"$set": {
                "variants": variants,
                "price": min(variant["price"] for variant in variants),
                "mrp": min(variant["mrp"] for variant in variants),
            }})
        if variant_inventory_records:
            await db.variant_inventory.insert_many(variant_inventory_records)
        await db.inventory.insert_many([
            Inventory(product_id=product["id"], seller_id=product["seller_id"], quantity=25).model_dump()
            for product in preview_products if product["id"] not in variant_product_ids
        ])
        logger.info("Loaded Perfurm preview catalog")
    if USE_MOCK_DB and await db.reviews.count_documents({}) == 0:
        review_products = await db.products.find({"is_active": True}, {"_id": 0, "id": 1}).sort("sku", 1).to_list(10)
        demo_reviews = [
            ("Aarohi", 5, "The discovery journey felt personal and unhurried. The scent developed beautifully through the day."),
            ("Kabir", 5, "Excellent projection without becoming overpowering. The bottle and packaging feel genuinely premium."),
            ("Meera", 5, "I started with the smaller bottle and came back for the full size. The variant pricing made choosing easy."),
            ("Vihaan", 5, "Authentic fragrance, careful packing and a polished unboxing experience. It arrived exactly as promised."),
            ("Ananya", 5, "The notes are balanced and elegant. I received compliments the first evening I wore it."),
            ("Reyansh", 4, "A refined everyday fragrance with impressive longevity. The travel size is especially convenient."),
            ("Ishita", 5, "The recommendation was spot on. It feels distinctive, warm and far more luxurious than expected."),
            ("Arjun", 4, "Clear bottle-size choices, quick delivery and no surprises at checkout. I would order again."),
            ("Saanvi", 5, "Beautiful presentation for gifting, and the fragrance itself feels thoughtful rather than generic."),
            ("Dev", 5, "From browsing to delivery, everything felt considered. The dry-down is the part I love most."),
        ]
        now = datetime.now(timezone.utc)
        await db.reviews.insert_many([
            Review(
                id=f"demo-review-{index + 1}", product_id=review_products[index]["id"],
                customer_id=f"demo-reviewer-{index + 1}", customer_name=name,
                order_id=f"demo-delivered-order-{index + 1}", order_item_key=f"demo-review:{index + 1}",
                rating=rating, comment=comment, verified_purchase=True, moderation_status="approved",
                helpful_count=max(2, 24 - index * 2), created_at=now - timedelta(days=index + 1),
                moderation_history=[{"status": "approved", "at": now, "actor_id": "preview-admin-user", "reason": "Curated preview review"}],
            ).model_dump()
            for index, (name, rating, comment) in enumerate(demo_reviews)
        ])
        logger.info("Loaded 10 approved preview reviews")
    if USE_MOCK_DB and await db.pincode_rules.count_documents({}) == 0:
        preview_locations = [
            ("110001", "New Delhi", "Delhi", 3), ("400001", "Mumbai", "Maharashtra", 2),
            ("560001", "Bengaluru", "Karnataka", 3), ("600001", "Chennai", "Tamil Nadu", 4),
            ("700001", "Kolkata", "West Bengal", 4), ("500001", "Hyderabad", "Telangana", 3),
            ("380001", "Ahmedabad", "Gujarat", 4), ("411001", "Pune", "Maharashtra", 3),
        ]
        await db.pincode_rules.insert_many([
            PincodeRule(pincode=code, city=city, state=state, delivery_days=days).model_dump()
            for code, city, state, days in preview_locations
        ])
        logger.info("Loaded preview serviceability rules")
    if USE_MOCK_DB and await db.coupons.count_documents({}) == 0:
        now = datetime.now(timezone.utc)
        await db.coupons.insert_many([
            Coupon(
                id="demo-welcome10", code="WELCOME10", discount_type="percentage",
                discount_value=10, min_order_amount=999, max_discount=500,
                valid_from=now - timedelta(days=1), valid_until=now + timedelta(days=365),
                usage_limit=10000, per_customer_usage_limit=1,
            ).model_dump(),
            Coupon(
                id="demo-scent300", code="SCENT300", discount_type="fixed",
                discount_value=300, min_order_amount=2499,
                valid_from=now - timedelta(days=1), valid_until=now + timedelta(days=365),
                usage_limit=10000, per_customer_usage_limit=1,
            ).model_dump(),
        ])
        logger.info("Loaded preview coupon offers")
    if USE_MOCK_DB and await db.offer_cards.count_documents({}) == 0:
        await db.offer_cards.insert_many([
            OfferCard(
                id="demo-guest-offer", title="Your first Perfurm ritual",
                description="Use WELCOME10 for 10% off up to ₹500 on orders above ₹999.",
                image_url="https://images.unsplash.com/photo-1541643600914-78b084683601?w=900",
                link_url="/customer/category/all", display_order=1,
            ).model_dump(),
            OfferCard(
                id="demo-member-offer", title="₹300 toward your signature scent",
                description="Members use SCENT300 on orders above ₹2,499. One use per account.",
                image_url="https://images.unsplash.com/photo-1594035910387-fea47794261f?w=900",
                link_url="/customer/category/all", display_order=2,
            ).model_dump(),
        ])
        logger.info("Loaded preview offer cards")
    if USE_MOCK_DB and await db.creator_campaigns.count_documents({}) == 0:
        await db.creator_campaigns.insert_many([
            CreatorCampaign(id="creator-campaign-1", title="A scent for golden hour", creator_name="Aanya Mehta", media_url="https://images.unsplash.com/photo-1547887538-e3a2f32cb1cc?w=900", caption="A warm floral ritual styled for slow evenings.", destination_url="/customer/category/For%20Her", social_channel="instagram", campaign_code="AANYA10", display_order=1).model_dump(),
            CreatorCampaign(id="creator-campaign-2", title="Inside my fragrance wardrobe", creator_name="Rohan Kapoor", media_url="https://images.unsplash.com/photo-1615634260167-c8cdede054de?w=900", caption="Three signatures for work, weekends and after hours.", destination_url="/customer/category/For%20Him", social_channel="youtube", campaign_code="ROHAN10", display_order=2).model_dump(),
            CreatorCampaign(id="creator-campaign-3", title="The discovery-set challenge", creator_name="Mira & Co.", media_url="https://images.unsplash.com/photo-1588405748880-12d1d2a59f75?w=900", caption="Finding a signature scent without seeing the label.", destination_url="/customer/category/Discovery%20Sets", social_channel="instagram", campaign_code="MIRA10", display_order=3).model_dump(),
            CreatorCampaign(id="creator-campaign-4", title="Unboxing the gifting ritual", creator_name="The Style Edit", media_url="https://images.unsplash.com/photo-1594035910387-fea47794261f?w=900", caption="A creator-first look at Perfurm's keepsake presentation.", destination_url="/customer/category/Gifting", social_channel="facebook", campaign_code="STYLE10", display_order=4).model_dump(),
            CreatorCampaign(id="creator-campaign-5", title="A cinematic scent ritual", creator_name="Studio Aster", media_url="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", media_type="video", thumbnail_url="https://images.unsplash.com/photo-1619994403073-2cec844b8e63?w=900", caption="An editorial film about notes, memory and personal ritual.", destination_url="/customer/category/all", social_channel="instagram", campaign_code="ASTER10", display_order=5).model_dump(),
            CreatorCampaign(id="creator-campaign-6", title="Behind the bottle", creator_name="House of Noor", media_url="https://videos.pexels.com/video-files/2887463/2887463-hd_1920_1080_25fps.mp4", media_type="video", thumbnail_url="https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=900", caption="A short-form creator film exploring craftsmanship and the final spray.", destination_url="/customer/category/Unisex", social_channel="youtube", campaign_code="NOOR10", display_order=6).model_dump(),
            CreatorCampaign(id="creator-campaign-7", title="Licensed talent campaign preview", creator_name="Kriti Sanon", media_url="https://commons.wikimedia.org/wiki/Special:Redirect/file/Kriti_Sanon.jpg", caption="Demo photo slot for the approved Kriti Sanon campaign. Replace with the supplied final campaign asset in CMS. Photo: Bollywood Hungama, CC BY 3.0.", destination_url="/customer/category/For%20Her", social_channel="instagram", campaign_code="KRITI10", display_order=7).model_dump(),
            CreatorCampaign(id="creator-campaign-8", title="Licensed talent campaign preview", creator_name="Virat Kohli", media_url="https://commons.wikimedia.org/wiki/Special:Redirect/file/Virat_Kohli.jpg", caption="Demo photo slot for the approved Virat Kohli campaign. Replace with the supplied final campaign asset in CMS. Photo: Government of India, GODL.", destination_url="/customer/category/For%20Him", social_channel="instagram", campaign_code="VIRAT10", display_order=8).model_dump(),
            CreatorCampaign(id="creator-campaign-9", title="Licensed talent campaign preview", creator_name="Samay Raina", media_url="https://commons.wikimedia.org/wiki/Special:Redirect/file/Samay_raina_(cropped).jpg", caption="Demo photo slot for the approved Samay Raina campaign. Replace with the supplied final campaign asset in CMS. Photo: 9Vivek4, CC BY-SA 4.0.", destination_url="/customer/category/Unisex", social_channel="youtube", campaign_code="SAMAY10", display_order=9).model_dump(),
        ])
        logger.info("Loaded preview creator campaigns")
    logger.info("Database indexes created")
    if reservation_reaper_task is None or reservation_reaper_task.done():
        reservation_reaper_task = asyncio.create_task(reservation_reaper_loop())
    if notification_outbox_task is None or notification_outbox_task.done():
        notification_outbox_task = asyncio.create_task(notification_outbox_loop())
