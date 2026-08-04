"""
Seed script to populate the database with initial data for testing
Run with: python seed_data.py
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os
from dotenv import load_dotenv
from datetime import datetime, timezone
import uuid

load_dotenv()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def seed_database():
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'ecommerce_db')]
    
    print("🌱 Starting database seeding...")
    
    # Clear existing data
    await db.users.delete_many({})
    await db.sellers.delete_many({})
    await db.products.delete_many({})
    await db.inventory.delete_many({})
    await db.orders.delete_many({})
    await db.reviews.delete_many({})
    await db.notifications.delete_many({})
    
    print("✅ Cleared existing data")
    
    # Create Admin
    admin_id = str(uuid.uuid4())
    admin = {
        "id": admin_id,
        "email": "admin@marketplace.com",
        "password_hash": pwd_context.hash("admin123"),
        "role": "admin",
        "name": "Admin User",
        "phone": "1234567890",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True
    }
    await db.users.insert_one(admin)
    print(f"✅ Created admin: admin@marketplace.com / admin123")
    
    # Create Seller 1
    seller1_user_id = str(uuid.uuid4())
    seller1_user = {
        "id": seller1_user_id,
        "email": "seller1@example.com",
        "password_hash": pwd_context.hash("seller123"),
        "role": "seller",
        "name": "Fashion Store Owner",
        "phone": "9876543210",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True
    }
    await db.users.insert_one(seller1_user)
    
    seller1_id = str(uuid.uuid4())
    seller1 = {
        "id": seller1_id,
        "user_id": seller1_user_id,
        "business_name": "Fashion Hub",
        "business_email": "seller1@example.com",
        "business_phone": "9876543210",
        "gst_number": "GST123456",
        "address": "123 Fashion Street",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400001",
        "status": "approved",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "approved_by": admin_id
    }
    await db.sellers.insert_one(seller1)
    print(f"✅ Created seller1: seller1@example.com / seller123")
    
    # Create Seller 2
    seller2_user_id = str(uuid.uuid4())
    seller2_user = {
        "id": seller2_user_id,
        "email": "seller2@example.com",
        "password_hash": pwd_context.hash("seller123"),
        "role": "seller",
        "name": "Electronics Store Owner",
        "phone": "9876543211",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True
    }
    await db.users.insert_one(seller2_user)
    
    seller2_id = str(uuid.uuid4())
    seller2 = {
        "id": seller2_id,
        "user_id": seller2_user_id,
        "business_name": "Tech World",
        "business_email": "seller2@example.com",
        "business_phone": "9876543211",
        "gst_number": "GST789012",
        "address": "456 Tech Avenue",
        "city": "Bangalore",
        "state": "Karnataka",
        "pincode": "560001",
        "status": "approved",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "approved_by": admin_id
    }
    await db.sellers.insert_one(seller2)
    print(f"✅ Created seller2: seller2@example.com / seller123")
    
    # Create Customer
    customer_id = str(uuid.uuid4())
    customer = {
        "id": customer_id,
        "email": "customer@example.com",
        "password_hash": pwd_context.hash("customer123"),
        "role": "customer",
        "name": "John Doe",
        "phone": "9876543212",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True
    }
    await db.users.insert_one(customer)
    print(f"✅ Created customer: customer@example.com / customer123")
    
    # Sample products for Seller 1 (Fashion)
    fashion_products = [
        {
            "id": str(uuid.uuid4()),
            "seller_id": seller1_id,
            "name": "Premium Cotton T-Shirt",
            "description": "Comfortable and stylish cotton t-shirt perfect for daily wear",
            "category": "Clothing",
            "price": 599,
            "mrp": 999,
            "sku": "FSH001",
            "images": ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400"],
            "specifications": {"Material": "100% Cotton", "Fit": "Regular"},
            "sizes": ["S", "M", "L", "XL", "XXL"],
            "colors": [{"name": "Black", "hex": "#000000"}, {"name": "White", "hex": "#FFFFFF"}, {"name": "Navy", "hex": "#000080"}],
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "seller_id": seller1_id,
            "name": "Slim Fit Jeans",
            "description": "Trendy slim fit jeans with comfortable stretch fabric",
            "category": "Clothing",
            "price": 1299,
            "mrp": 1999,
            "sku": "FSH002",
            "images": ["https://images.unsplash.com/photo-1542272604-787c3835535d?w=400"],
            "specifications": {"Material": "Denim", "Fit": "Slim"},
            "sizes": ["28", "30", "32", "34", "36"],
            "colors": [{"name": "Blue", "hex": "#0000FF"}, {"name": "Black", "hex": "#000000"}],
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "seller_id": seller1_id,
            "name": "Casual Sneakers",
            "description": "Comfortable everyday sneakers with premium cushioning",
            "category": "Footwear",
            "price": 1799,
            "mrp": 2999,
            "sku": "FSH003",
            "images": ["https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400"],
            "specifications": {"Material": "Canvas"},
            "sizes": ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10"],
            "colors": [{"name": "White", "hex": "#FFFFFF"}, {"name": "Black", "hex": "#000000"}, {"name": "Red", "hex": "#FF0000"}],
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "seller_id": seller1_id,
            "name": "Leather Jacket",
            "description": "Genuine leather jacket with modern styling",
            "category": "Clothing",
            "price": 4999,
            "mrp": 7999,
            "sku": "FSH004",
            "images": ["https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400"],
            "specifications": {"Material": "Genuine Leather", "Fit": "Slim"},
            "sizes": ["S", "M", "L", "XL"],
            "colors": [{"name": "Brown", "hex": "#8B4513"}, {"name": "Black", "hex": "#000000"}],
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    # Sample products for Seller 2 (Electronics)
    tech_products = [
        {
            "id": str(uuid.uuid4()),
            "seller_id": seller2_id,
            "name": "Wireless Bluetooth Headphones",
            "description": "Premium noise-canceling wireless headphones with 30hr battery",
            "category": "Electronics",
            "price": 2999,
            "mrp": 4999,
            "sku": "TECH001",
            "images": ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400"],
            "specifications": {"Battery": "30 hours", "Connectivity": "Bluetooth 5.0", "Color": "Black"},
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "seller_id": seller2_id,
            "name": "Smartphone Stand",
            "description": "Adjustable phone stand for desk and table use",
            "category": "Accessories",
            "price": 399,
            "mrp": 699,
            "sku": "TECH002",
            "images": ["https://images.unsplash.com/photo-1607082349566-187342175e2f?w=400"],
            "specifications": {"Material": "Aluminum", "Adjustable": "Yes", "Color": "Silver"},
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "seller_id": seller2_id,
            "name": "Wireless Charging Pad",
            "description": "Fast wireless charging pad compatible with all Qi devices",
            "category": "Accessories",
            "price": 899,
            "mrp": 1499,
            "sku": "TECH003",
            "images": ["https://images.unsplash.com/photo-1591290619762-83d0e3b5f010?w=400"],
            "specifications": {"Charging Speed": "10W Fast Charge", "Compatibility": "Qi-enabled devices", "Color": "Black"},
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "seller_id": seller2_id,
            "name": "USB-C Hub",
            "description": "7-in-1 USB-C hub with HDMI, USB 3.0, and card readers",
            "category": "Accessories",
            "price": 1499,
            "mrp": 2499,
            "sku": "TECH004",
            "images": ["https://images.unsplash.com/photo-1625948515291-69613efd103f?w=400"],
            "specifications": {"Ports": "7-in-1", "Compatibility": "USB-C devices", "Color": "Gray"},
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    all_products = fashion_products + tech_products
    await db.products.insert_many(all_products)
    print(f"✅ Created {len(all_products)} products")
    
    # Create inventory for all products
    inventory_items = []
    for product in all_products:
        inventory_items.append({
            "id": str(uuid.uuid4()),
            "product_id": product["id"],
            "seller_id": product["seller_id"],
            "quantity": 50,
            "low_stock_threshold": 10,
            "last_restocked": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        })
    
    await db.inventory.insert_many(inventory_items)
    print(f"✅ Created inventory for all products")
    
    # Create warehouses for sellers
    warehouses = [
        {
            "id": str(uuid.uuid4()),
            "seller_id": seller1_id,
            "name": "Main Warehouse",
            "address_line": "123 Fashion Street",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400001",
            "phone": "9876543210",
            "is_default": True,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "seller_id": seller2_id,
            "name": "Tech Hub Warehouse",
            "address_line": "456 Tech Park",
            "city": "Bangalore",
            "state": "Karnataka",
            "pincode": "560001",
            "phone": "9876543211",
            "is_default": True,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.warehouses.insert_many(warehouses)
    print(f"✅ Created {len(warehouses)} warehouses")
    
    client.close()
    print("\n🎉 Database seeding completed successfully!")
    print("\n📋 Test Accounts:")
    print("  Admin:    admin@marketplace.com / admin123")
    print("  Seller 1: seller1@example.com / seller123")
    print("  Seller 2: seller2@example.com / seller123")
    print("  Customer: customer@example.com / customer123")
    print("\n✨ You can now test the application with these accounts!")

if __name__ == "__main__":
    asyncio.run(seed_database())
