from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, File, UploadFile
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import razorpay
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
import certifi
mongo_url = os.environ["MONGO_URL"]

client = AsyncIOMotorClient(
    mongo_url,
    tlsCAFile=certifi.where()
)

db = client[os.environ.get("DB_NAME", "ecommerce_db")]
# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Payment gateways (configure in .env)
razorpay_client = None
if os.environ.get('RAZORPAY_KEY_ID') and os.environ.get('RAZORPAY_KEY_SECRET'):
    razorpay_client = razorpay.Client(
        auth=(os.environ['RAZORPAY_KEY_ID'], os.environ['RAZORPAY_KEY_SECRET'])
    )

# Create the main app
app = FastAPI(title="Multi-Seller Ecommerce API")
api_router = APIRouter(prefix="/api")

# ============== ENUMS ==============
class UserRole(str, Enum):
    ADMIN = "admin"
    SELLER = "seller"
    CUSTOMER = "customer"
    DELIVERY_PARTNER = "delivery_partner"

class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PACKED = "packed"
    SHIPPED = "shipped"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    RETURNED = "returned"
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

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    role: UserRole = UserRole.CUSTOMER

class UserLogin(BaseModel):
    email: EmailStr
    password: str

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

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    seller_id: str
    name: str
    description: str
    category: str
    price: float
    mrp: float
    sku: str
    images: List[str] = []
    videos: List[str] = []  # Video URLs
    specifications: Dict[str, Any] = {}
    filters: Dict[str, Any] = {}  # Size, Color, Brand, etc.
    colors: List[Dict[str, str]] = []  # [{name: "Red", hex: "#FF0000", image: "url"}]
    sizes: List[str] = []  # ["S", "M", "L", "XL"]
    color_images: Dict[str, List[str]] = {}  # {"Red": ["img1", "img2"], "Blue": ["img3"]}
    is_active: bool = True
    view_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreate(BaseModel):
    name: str
    description: str
    category: str
    price: float
    mrp: float
    sku: str
    images: List[str] = []
    videos: List[str] = []
    specifications: Dict[str, Any] = {}
    filters: Dict[str, Any] = {}
    colors: List[Dict[str, str]] = []
    sizes: List[str] = []
    color_images: Dict[str, List[str]] = {}

class Inventory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    seller_id: str
    quantity: int
    low_stock_threshold: int = 10
    last_restocked: Optional[datetime] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InventoryUpdate(BaseModel):
    quantity: int
    low_stock_threshold: Optional[int] = None

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str
    items: List[Dict[str, Any]]  # [{product_id, seller_id, name, price, quantity}]
    total_amount: float
    status: OrderStatus = OrderStatus.PENDING
    payment_id: Optional[str] = None
    payment_status: str = "pending"
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
    shipping_address: Dict[str, str]

class Review(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    customer_id: str
    customer_name: str
    order_id: str
    rating: int  # 1-5
    comment: Optional[str] = None
    images: List[str] = []  # Customer uploaded photos
    helpful_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReviewCreate(BaseModel):
    product_id: str
    order_id: str
    rating: int
    comment: Optional[str] = None
    images: List[str] = []

class Coupon(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    discount_type: str  # percentage, fixed
    discount_value: float
    min_order_amount: float = 0
    max_discount: Optional[float] = None
    valid_from: datetime
    valid_until: datetime
    is_active: bool = True
    usage_limit: Optional[int] = None
    used_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CouponCreate(BaseModel):
    code: str
    discount_type: str
    discount_value: float
    min_order_amount: float = 0
    max_discount: Optional[float] = None
    valid_from: datetime
    valid_until: datetime
    usage_limit: Optional[int] = None

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
    name: str
    phone: str
    pincode: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    landmark: Optional[str] = None
    address_type: str = "home"
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
    return_window_days: int = 7  # 7, 10, or 15
    replacement_enabled: bool = True
    replacement_window_days: int = 7
    conditions: Optional[str] = "Product must be unused and in original packaging"
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReturnRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    customer_id: str
    seller_id: str
    reason: str
    request_type: str  # return, replacement, cancel
    status: str = "pending"  # pending, approved, rejected, completed
    images: List[str] = []
    admin_remarks: Optional[str] = None
    refund_amount: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReturnRequestCreate(BaseModel):
    order_id: str
    reason: str
    request_type: str
    images: List[str] = []

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
    about_text: str = "Your trusted multi-seller marketplace"
    facebook_url: Optional[str] = None
    instagram_url: Optional[str] = None
    twitter_url: Optional[str] = None
    youtube_url: Optional[str] = None
    contact_email: str = "support@blackmoney.com"
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
    platform_fee_percentage: Optional[float] = None
    promotion_fee_percentage: Optional[float] = None
    gst_percentage: Optional[float] = None
    payment_cycle_days: Optional[int] = None

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
    support_email: str = "support@blackmoney.com"
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

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
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

# ============== HELPER FUNCTIONS ==============
def generate_tracking_id() -> str:
    """Generate unique tracking ID like Flipkart (e.g., FMP123456789)"""
    import random
    import string
    prefix = "FMP"  # Fast Marketplace
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
async def register(user_data: UserCreate):
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
async def login(credentials: UserLogin):
    logger.info(f"Login attempt for email: {credentials.email}")
    user = await db.users.find_one({"email": credentials.email})
    if not user:
        logger.warning(f"User not found: {credentials.email}")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(credentials.password, user["password_hash"]):
        logger.warning(f"Password verification failed for: {credentials.email}")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is inactive")
    
    token = create_access_token({"sub": user["id"], "role": user["role"]})
    del user["password_hash"]
    del user["_id"]
    
    return Token(access_token=token, token_type="bearer", user=user)

@api_router.get("/auth/me")
async def get_me(user: Dict[str, Any] = Depends(get_current_user)):
    return user

# ============== OTP AUTHENTICATION ==============
import random
import string

# In-memory OTP storage (use Redis in production)
otp_storage = {}

def generate_otp():
    return ''.join(random.choices(string.digits, k=6))

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
async def send_otp(request: OtpRequest):
    """Send OTP for phone login"""
    phone = request.phone
    if not phone or len(phone) != 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    
    # Check if user exists with this phone
    user = await db.users.find_one({"phone": phone})
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this phone number")
    
    otp = generate_otp()
    otp_storage[f"login_{phone}"] = {
        "otp": otp,
        "expires": datetime.now(timezone.utc) + timedelta(minutes=10),
        "attempts": 0
    }
    
    # In production, integrate with SMS/WhatsApp API
    # For now, log the OTP (DEMO MODE)
    logger.info(f"OTP for {phone} ({request.method}): {otp}")
    
    return {"message": f"OTP sent via {request.method}", "demo_otp": otp}  # Remove demo_otp in production

@api_router.post("/auth/verify-otp-login", response_model=Token)
async def verify_otp_login(request: OtpVerifyLogin):
    """Verify OTP and login"""
    phone = request.phone
    otp_key = f"login_{phone}"
    
    if otp_key not in otp_storage:
        raise HTTPException(status_code=400, detail="OTP expired or not sent")
    
    stored = otp_storage[otp_key]
    
    if stored["attempts"] >= 3:
        del otp_storage[otp_key]
        raise HTTPException(status_code=429, detail="Too many attempts. Please request new OTP")
    
    if datetime.now(timezone.utc) > stored["expires"]:
        del otp_storage[otp_key]
        raise HTTPException(status_code=400, detail="OTP expired")
    
    if stored["otp"] != request.otp:
        stored["attempts"] += 1
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # OTP verified - login user
    del otp_storage[otp_key]
    
    user = await db.users.find_one({"phone": phone})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    token = create_access_token({"sub": user["id"], "role": user["role"]})
    del user["password_hash"]
    del user["_id"]
    
    return Token(access_token=token, token_type="bearer", user=user)

@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Send OTP for password reset"""
    user = await db.users.find_one({"email": request.email})
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email")
    
    otp = generate_otp()
    otp_storage[f"reset_{request.email}"] = {
        "otp": otp,
        "expires": datetime.now(timezone.utc) + timedelta(minutes=10),
        "attempts": 0,
        "verified": False
    }
    
    # In production, send email with OTP
    logger.info(f"Password reset OTP for {request.email}: {otp}")
    
    return {"message": "OTP sent to your email", "demo_otp": otp}  # Remove demo_otp in production

@api_router.post("/auth/verify-reset-otp")
async def verify_reset_otp(request: VerifyResetOtp):
    """Verify OTP for password reset"""
    otp_key = f"reset_{request.email}"
    
    if otp_key not in otp_storage:
        raise HTTPException(status_code=400, detail="OTP expired or not sent")
    
    stored = otp_storage[otp_key]
    
    if stored["attempts"] >= 3:
        del otp_storage[otp_key]
        raise HTTPException(status_code=429, detail="Too many attempts. Please request new OTP")
    
    if datetime.now(timezone.utc) > stored["expires"]:
        del otp_storage[otp_key]
        raise HTTPException(status_code=400, detail="OTP expired")
    
    if stored["otp"] != request.otp:
        stored["attempts"] += 1
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Mark OTP as verified
    stored["verified"] = True
    
    return {"message": "OTP verified successfully"}

@api_router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password after OTP verification"""
    otp_key = f"reset_{request.email}"
    
    if otp_key not in otp_storage:
        raise HTTPException(status_code=400, detail="Please verify OTP first")
    
    stored = otp_storage[otp_key]
    
    if not stored.get("verified"):
        raise HTTPException(status_code=400, detail="Please verify OTP first")
    
    if stored["otp"] != request.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Update password
    new_hash = hash_password(request.new_password)
    await db.users.update_one(
        {"email": request.email},
        {"$set": {"password_hash": new_hash}}
    )
    
    del otp_storage[otp_key]
    
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
@api_router.post("/products", response_model=Product)
async def create_product(
    product_data: ProductCreate,
    user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))
):
    # Check if seller is approved
    seller = await db.sellers.find_one({"user_id": user["id"]})
    if not seller or seller["status"] != SellerStatus.APPROVED.value:
        raise HTTPException(status_code=403, detail="Seller not approved")
    
    product = Product(
        seller_id=seller["id"],
        **product_data.model_dump()
    )
    
    await db.products.insert_one(product.model_dump())
    
    # Initialize inventory
    inventory = Inventory(
        product_id=product.id,
        seller_id=seller["id"],
        quantity=0
    )
    await db.inventory.insert_one(inventory.model_dump())
    
    return product

@api_router.get("/products", response_model=List[Product])
async def get_products(category: Optional[str] = None, seller_id: Optional[str] = None):
    query = {"is_active": True}
    if category:
        query["category"] = category
    if seller_id:
        query["seller_id"] = seller_id
    
    products = await db.products.find(query, {"_id": 0}).to_list(1000)
    return products

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
    
    return products

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
    
    return products

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
    
    return similar

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(
    product_id: str,
    product_data: ProductCreate,
    user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))
):
    seller = await db.sellers.find_one({"user_id": user["id"]})
    product = await db.products.find_one({"id": product_id})
    
    if not product or product["seller_id"] != seller["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.products.update_one(
        {"id": product_id},
        {"$set": {**product_data.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}}
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

# ============== ORDER ROUTES ==============
@api_router.post("/orders", response_model=Order)
async def create_order(
    order_data: OrderCreate,
    user: Dict[str, Any] = Depends(require_role([UserRole.CUSTOMER]))
):
    # Verify inventory
    for item in order_data.items:
        inventory = await db.inventory.find_one({"product_id": item["product_id"]})
        if not inventory or inventory["quantity"] < item["quantity"]:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {item['name']}")
    
    # Calculate platform fee (2% of total amount)
    fee_calculation = calculate_platform_fee(order_data.total_amount, 2.0)
    
    order = Order(
        customer_id=user["id"],
        platform_fee_percentage=2.0,
        platform_fee_amount=fee_calculation["fee_amount"],
        seller_payout=fee_calculation["seller_payout"],
        **order_data.model_dump()
    )
    
    await db.orders.insert_one(order.model_dump())
    
    # Update inventory
    for item in order_data.items:
        await db.inventory.update_one(
            {"product_id": item["product_id"]},
            {"$inc": {"quantity": -item["quantity"]}}
        )
    
    # Group items by seller and create platform fee records
    seller_items = {}
    for item in order_data.items:
        seller_id = item["seller_id"]
        if seller_id not in seller_items:
            seller_items[seller_id] = []
        seller_items[seller_id].append(item)
    
    for seller_id, items in seller_items.items():
        # Calculate seller-specific order amount
        seller_order_amount = sum([item["price"] * item["quantity"] for item in items])
        seller_fee_calc = calculate_platform_fee(seller_order_amount, 2.0)
        
        # Create platform fee record for this seller
        platform_fee = PlatformFee(
            order_id=order.id,
            seller_id=seller_id,
            order_amount=seller_order_amount,
            fee_percentage=2.0,
            fee_amount=seller_fee_calc["fee_amount"],
            seller_payout=seller_fee_calc["seller_payout"],
            status="pending"
        )
        await db.platform_fees.insert_one(platform_fee.model_dump())
        
        # Notify seller
        seller = await db.sellers.find_one({"id": seller_id})
        notification = Notification(
            user_id=seller["user_id"],
            title="New Order Received",
            message=f"Order #{order.id} - {len(items)} items | Payout: ₹{seller_fee_calc['seller_payout']} (After 2% platform fee)",
            type="order_update"
        )
        await db.notifications.insert_one(notification.model_dump())
    
    # Notify customer
    customer_notification = Notification(
        user_id=user["id"],
        title="Order Placed",
        message=f"Your order #{order.id} has been placed successfully",
        type="order_update"
    )
    await db.notifications.insert_one(customer_notification.model_dump())
    
    return order

@api_router.get("/orders/my", response_model=List[Order])
async def get_my_orders(user: Dict[str, Any] = Depends(get_current_user)):
    if user["role"] == UserRole.CUSTOMER.value:
        orders = await db.orders.find({"customer_id": user["id"]}, {"_id": 0}).to_list(1000)
    elif user["role"] == UserRole.SELLER.value:
        seller = await db.sellers.find_one({"user_id": user["id"]})
        orders = await db.orders.find(
            {"items.seller_id": seller["id"]},
            {"_id": 0}
        ).to_list(1000)
    else:  # Admin
        orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
    
    return orders

@api_router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Authorization check
    if user["role"] == UserRole.CUSTOMER.value and order["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return order

@api_router.put("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    status: OrderStatus,
    user: Dict[str, Any] = Depends(require_role([UserRole.SELLER, UserRole.ADMIN]))
):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": status.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Notify customer
    notification = Notification(
        user_id=order["customer_id"],
        title="Order Update",
        message=f"Your order #{order_id} is now {status.value}",
        type="order_update"
    )
    await db.notifications.insert_one(notification.model_dump())
    
    return {"message": "Order status updated"}

# ============== REVIEW ROUTES ==============
@api_router.post("/reviews", response_model=Review)
async def create_review(
    review_data: ReviewCreate,
    user: Dict[str, Any] = Depends(require_role([UserRole.CUSTOMER]))
):
    # Verify order exists and belongs to user
    order = await db.orders.find_one({"id": review_data.order_id, "customer_id": user["id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    review = Review(
        customer_id=user["id"],
        customer_name=user["name"],
        **review_data.model_dump()
    )
    
    await db.reviews.insert_one(review.model_dump())
    return review

@api_router.get("/reviews/product/{product_id}", response_model=List[Review])
async def get_product_reviews(product_id: str):
    reviews = await db.reviews.find({"product_id": product_id}, {"_id": 0}).to_list(1000)
    return reviews

# ============== NOTIFICATION ROUTES ==============
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
    
    return {
        "total_users": total_users,
        "total_sellers": total_sellers,
        "pending_sellers": pending_sellers,
        "total_products": total_products,
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "total_platform_fee": total_platform_fee
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
    
    coupon = Coupon(
        **coupon_data.model_dump(),
        code=coupon_data.code.upper()
    )
    
    await db.coupons.insert_one(coupon.model_dump())
    return coupon

@api_router.get("/coupons/validate/{code}")
async def validate_coupon(code: str, order_amount: float):
    coupon = await db.coupons.find_one({"code": code.upper(), "is_active": True}, {"_id": 0})
    
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found or inactive")
    
    now = datetime.now(timezone.utc)
    valid_from = datetime.fromisoformat(coupon["valid_from"]) if isinstance(coupon["valid_from"], str) else coupon["valid_from"]
    valid_until = datetime.fromisoformat(coupon["valid_until"]) if isinstance(coupon["valid_until"], str) else coupon["valid_until"]
    
    if now < valid_from or now > valid_until:
        raise HTTPException(status_code=400, detail="Coupon has expired or not yet valid")
    
    if order_amount < coupon["min_order_amount"]:
        raise HTTPException(status_code=400, detail=f"Minimum order amount is ₹{coupon['min_order_amount']}")
    
    if coupon.get("usage_limit") and coupon["used_count"] >= coupon["usage_limit"]:
        raise HTTPException(status_code=400, detail="Coupon usage limit reached")
    
    # Calculate discount
    if coupon["discount_type"] == "percentage":
        discount = order_amount * (coupon["discount_value"] / 100)
        if coupon.get("max_discount"):
            discount = min(discount, coupon["max_discount"])
    else:  # fixed
        discount = coupon["discount_value"]
    
    return {
        "valid": True,
        "discount": discount,
        "code": coupon["code"],
        "discount_type": coupon["discount_type"]
    }

@api_router.get("/coupons/active")
async def get_active_coupons():
    now = datetime.now(timezone.utc)
    coupons = await db.coupons.find({
        "is_active": True,
        "valid_until": {"$gte": now.isoformat()}
    }, {"_id": 0}).to_list(100)
    return coupons

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
    return products

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
@api_router.get("/pincode/{pincode}")
async def get_pincode_details(pincode: str):
    # Mock pincode data - In production, integrate with actual postal API
    pincode_data = {
        "110001": {"city": "New Delhi", "state": "Delhi", "delivery_days": 3},
        "400001": {"city": "Mumbai", "state": "Maharashtra", "delivery_days": 2},
        "560001": {"city": "Bangalore", "state": "Karnataka", "delivery_days": 3},
        "600001": {"city": "Chennai", "state": "Tamil Nadu", "delivery_days": 4},
        "700001": {"city": "Kolkata", "state": "West Bengal", "delivery_days": 4},
        "500001": {"city": "Hyderabad", "state": "Telangana", "delivery_days": 3},
        "380001": {"city": "Ahmedabad", "state": "Gujarat", "delivery_days": 4},
        "411001": {"city": "Pune", "state": "Maharashtra", "delivery_days": 3},
        "302001": {"city": "Jaipur", "state": "Rajasthan", "delivery_days": 4},
        "226001": {"city": "Lucknow", "state": "Uttar Pradesh", "delivery_days": 4},
    }
    
    # Check if pincode exists in our mock data or generate based on pattern
    if pincode in pincode_data:
        data = pincode_data[pincode]
    elif len(pincode) == 6 and pincode.isdigit():
        # Generate mock data for unknown pincodes
        prefix = pincode[:2]
        state_map = {
            "11": ("Delhi", "Delhi"),
            "12": ("Faridabad", "Haryana"),
            "20": ("Agra", "Uttar Pradesh"),
            "22": ("Lucknow", "Uttar Pradesh"),
            "30": ("Jaipur", "Rajasthan"),
            "38": ("Ahmedabad", "Gujarat"),
            "40": ("Mumbai", "Maharashtra"),
            "41": ("Pune", "Maharashtra"),
            "44": ("Nagpur", "Maharashtra"),
            "50": ("Hyderabad", "Telangana"),
            "56": ("Bangalore", "Karnataka"),
            "60": ("Chennai", "Tamil Nadu"),
            "70": ("Kolkata", "West Bengal"),
            "80": ("Patna", "Bihar"),
        }
        if prefix in state_map:
            city, state = state_map[prefix]
        else:
            city = "Unknown City"
            state = "Unknown State"
        data = {"city": city, "state": state, "delivery_days": 5}
    else:
        raise HTTPException(status_code=400, detail="Invalid pincode format")
    
    return {
        "pincode": pincode,
        "city": data["city"],
        "state": data["state"],
        "delivery_available": True,
        "estimated_delivery_days": data["delivery_days"],
        "cod_available": True
    }

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
    settings_data: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user)
):
    settings_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.user_settings.update_one(
        {"user_id": user["id"]},
        {"$set": settings_data},
        upsert=True
    )
    
    return {"message": "Settings updated"}

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

# ============== REVIEW ENHANCEMENTS ==============
@api_router.put("/reviews/{review_id}/helpful")
async def mark_review_helpful(review_id: str):
    await db.reviews.update_one(
        {"id": review_id},
        {"$inc": {"helpful_count": 1}}
    )
    return {"message": "Marked as helpful"}

@api_router.get("/reviews/product/{product_id}/summary")
async def get_review_summary(product_id: str):
    reviews = await db.reviews.find({"product_id": product_id}, {"_id": 0}).to_list(10000)
    
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
    user: Dict[str, Any] = Depends(require_role([UserRole.SELLER]))
):
    """Generate shipping label with tracking ID and barcode"""
    # Verify seller owns this order
    order = await db.orders.find_one({"id": label_data.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    seller = await db.sellers.find_one({"user_id": user["id"]})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    
    # Verify seller owns products in this order
    seller_items = [item for item in order["items"] if item.get("seller_id") == seller["id"]]
    if not seller_items:
        raise HTTPException(status_code=403, detail="You don't have items in this order")
    
    # Check if label already exists
    existing_label = await db.shipping_labels.find_one({"order_id": label_data.order_id})
    if existing_label:
        return existing_label
    
    # Generate tracking ID and barcode
    tracking_id = generate_tracking_id()
    barcode = generate_barcode(tracking_id)
    
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
async def track_order(order_id: str):
    """Public endpoint to track order by tracking ID or order ID"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
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
    
    try:
        # Convert amount to paise (Razorpay requires amount in smallest currency unit)
        amount_in_paise = int(payment_data.amount * 100)
        
        # Create Razorpay order
        razorpay_order = razorpay_client.order.create({
            "amount": amount_in_paise,
            "currency": "INR",
            "payment_capture": 1,  # Auto capture payment
            "notes": payment_data.notes or {}
        })
        
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
    
    try:
        # Verify signature
        razorpay_client.utility.verify_payment_signature({
            'razorpay_order_id': verification_data.razorpay_order_id,
            'razorpay_payment_id': verification_data.razorpay_payment_id,
            'razorpay_signature': verification_data.razorpay_signature
        })
        
        # Update order with payment details
        await db.orders.update_one(
            {"id": verification_data.internal_order_id},
            {
                "$set": {
                    "payment_status": "paid",
                    "payment_id": verification_data.razorpay_payment_id,
                    "razorpay_order_id": verification_data.razorpay_order_id,
                    "paid_at": datetime.now(timezone.utc)
                }
            }
        )
        
        return {"status": "success", "message": "Payment verified successfully"}
        
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Payment verification failed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Payment verification error: {str(e)}")

@api_router.get("/payments/status/{order_id}")
async def get_payment_status(
    order_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get payment status for an order"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {
        "order_id": order_id,
        "payment_status": order.get("payment_status", "pending"),
        "payment_id": order.get("payment_id"),
        "paid_at": order.get("paid_at")
    }

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
    return_window_days: int,
    replacement_enabled: bool,
    replacement_window_days: int,
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
    """Customer creates return/cancel request"""
    order = await db.orders.find_one({"id": request_data.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get seller_id from first item
    seller_id = order["items"][0]["seller_id"]
    
    return_request = ReturnRequest(
        customer_id=user["id"],
        seller_id=seller_id,
        **request_data.model_dump()
    )
    
    await db.return_requests.insert_one(return_request.model_dump())
    
    # Notify seller
    seller = await db.sellers.find_one({"id": seller_id})
    notification = Notification(
        user_id=seller["user_id"],
        title=f"New {request_data.request_type.capitalize()} Request",
        message=f"Order #{request_data.order_id} - {request_data.reason}",
        type="return_request"
    )
    await db.notifications.insert_one(notification.model_dump())
    
    return return_request

@api_router.get("/return-requests/my")
async def get_my_return_requests(user: Dict[str, Any] = Depends(get_current_user)):
    """Get user's return requests"""
    query = {"customer_id": user["id"]} if user["role"] == "customer" else {}
    
    if user["role"] == "seller":
        seller = await db.sellers.find_one({"user_id": user["id"]})
        query = {"seller_id": seller["id"]}
    
    requests = await db.return_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests

@api_router.put("/return-requests/{request_id}/status")
async def update_return_request_status(
    request_id: str,
    status: str,
    admin_remarks: Optional[str] = None,
    refund_amount: Optional[float] = None,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Update return request status"""
    request = await db.return_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    update_data = {
        "status": status,
        "updated_at": datetime.now(timezone.utc)
    }
    
    if admin_remarks:
        update_data["admin_remarks"] = admin_remarks
    if refund_amount:
        update_data["refund_amount"] = refund_amount
    
    await db.return_requests.update_one({"id": request_id}, {"$set": update_data})
    
    # Notify customer
    notification = Notification(
        user_id=request["customer_id"],
        title=f"Return Request {status.capitalize()}",
        message=f"Your {request['request_type']} request has been {status}",
        type="return_update"
    )
    await db.notifications.insert_one(notification.model_dump())
    
    return {"message": "Status updated"}

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
        await db.footer_content.insert_one(content)
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

# ============== CATEGORY LIST API ==============
@api_router.get("/categories/list")
async def get_categories_list():
    """Get list of all categories"""
    return [
        "Men",
        "Women", 
        "Kids",
        "Accessories",
        "Footwear",
        "Winter Wear",
        "Sale",
        "New Arrivals"
    ]

# ============== STOREFRONT VISIBILITY APIS ==============
@api_router.get("/storefront-visibility")
async def get_storefront_visibility():
    """Get storefront visibility settings"""
    visibility = await db.storefront_visibility.find_one({"id": "storefront_visibility"}, {"_id": 0})
    if not visibility:
        visibility = StorefrontVisibility().model_dump()
        await db.storefront_visibility.insert_one(visibility)
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
    
    return products

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


# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

@app.on_event("startup")
async def startup_db():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.products.create_index("seller_id")
    await db.orders.create_index("customer_id")
    await db.notifications.create_index("user_id")
    logger.info("Database indexes created")
