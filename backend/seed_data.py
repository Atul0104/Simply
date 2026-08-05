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
        "email": "admin@perfurm.com",
        "password_hash": pwd_context.hash("admin123"),
        "role": "admin",
        "name": "Admin User",
        "phone": "1234567890",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True
    }
    await db.users.insert_one(admin)
    print(f"✅ Created admin: admin@perfurm.com / admin123")
    
    # Create Seller 1
    seller1_user_id = str(uuid.uuid4())
    seller1_user = {
        "id": seller1_user_id,
        "email": "seller1@example.com",
        "password_hash": pwd_context.hash("seller123"),
        "role": "seller",
        "name": "Atelier Fragrance Curator",
        "phone": "9876543210",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True
    }
    await db.users.insert_one(seller1_user)
    
    seller1_id = str(uuid.uuid4())
    seller1 = {
        "id": seller1_id,
        "user_id": seller1_user_id,
        "business_name": "Atelier No. 9",
        "business_email": "seller1@example.com",
        "business_phone": "9876543210",
        "gst_number": "GST123456",
        "address": "123 Garden Lane",
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
        "name": "Independent Perfumer",
        "phone": "9876543211",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True
    }
    await db.users.insert_one(seller2_user)
    
    seller2_id = str(uuid.uuid4())
    seller2 = {
        "id": seller2_id,
        "user_id": seller2_user_id,
        "business_name": "Sillage Studio",
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
            "name": "Velvet Oud Eau de Parfum",
            "description": "A deep oud softened by rose absolute and warm amber.",
            "category": "For Him",
            "price": 2890,
            "mrp": 3490,
            "sku": "PFM001",
            "images": ["https://images.unsplash.com/photo-1541643600914-78b084683601?w=600"],
            "specifications": {"Concentration": "Eau de Parfum", "Notes": "Oud, rose, amber"},
            "sizes": ["10 ml", "50 ml", "100 ml"],
            "colors": [],
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "seller_id": seller1_id,
            "name": "Rose After Rain",
            "description": "Dewy petals, pink pepper and clean musk with a luminous finish.",
            "category": "For Her",
            "price": 2490,
            "mrp": 2990,
            "sku": "PFM002",
            "images": ["https://images.unsplash.com/photo-1594035910387-fea47794261f?w=600"],
            "specifications": {"Concentration": "Eau de Parfum", "Notes": "Rose, pink pepper, white musk"},
            "sizes": ["10 ml", "50 ml", "100 ml"],
            "colors": [],
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "seller_id": seller1_id,
            "name": "The Signature Discovery Set",
            "description": "Six fragrances spanning citrus, floral, woods, amber, musk and oud.",
            "category": "Discovery Sets",
            "price": 1190,
            "mrp": 1490,
            "sku": "PFM003",
            "images": ["https://images.unsplash.com/photo-1588405748880-12d1d2a59f75?w=600"],
            "specifications": {"Includes": "6 × 2 ml", "Format": "Spray vials"},
            "sizes": ["6 × 2 ml"],
            "colors": [],
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "seller_id": seller1_id,
            "name": "Hinoki & Tea Home Mist",
            "description": "A quiet home fragrance of hinoki wood, steamed tea and incense.",
            "category": "Home Scents",
            "price": 1590,
            "mrp": 1890,
            "sku": "PFM004",
            "images": ["https://images.unsplash.com/photo-1603006905003-be475563bc59?w=600"],
            "specifications": {"Format": "Room spray", "Notes": "Hinoki, tea, incense"},
            "sizes": ["100 ml"],
            "colors": [],
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
            "name": "Salt Skin Eau de Parfum",
            "description": "Mineral air, bergamot and sun-warmed skin in an effortless unisex scent.",
            "category": "Unisex",
            "price": 2690,
            "mrp": 3290,
            "sku": "PFM005",
            "images": ["https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600"],
            "specifications": {"Concentration": "Eau de Parfum", "Notes": "Bergamot, sea salt, ambrette"},
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "seller_id": seller2_id,
            "name": "Cedar Ember Candle",
            "description": "Hand-poured wax scented with cedar, tobacco leaf and tonka bean.",
            "category": "Home Scents",
            "price": 1290,
            "mrp": 1590,
            "sku": "PFM006",
            "images": ["https://images.unsplash.com/photo-1602874801006-e26a19c6b631?w=600"],
            "specifications": {"Burn time": "45 hours", "Notes": "Cedar, tobacco, tonka"},
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "seller_id": seller2_id,
            "name": "Citrus Archive Eau de Toilette",
            "description": "Bright neroli and bitter orange grounded by vetiver and pale woods.",
            "category": "Unisex",
            "price": 2190,
            "mrp": 2690,
            "sku": "PFM007",
            "images": ["https://images.unsplash.com/photo-1615634260167-c8cdede054de?w=600"],
            "specifications": {"Concentration": "Eau de Toilette", "Notes": "Neroli, orange, vetiver"},
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "seller_id": seller2_id,
            "name": "Ritual Miniature Gift Set",
            "description": "Four signature extrait miniatures presented in a keepsake box.",
            "category": "Gifting",
            "price": 3490,
            "mrp": 3990,
            "sku": "PFM008",
            "images": ["https://images.unsplash.com/photo-1610461888750-10bfc601b874?w=600"],
            "specifications": {"Includes": "4 × 7.5 ml", "Presentation": "Gift box"},
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
    print("  Admin:    admin@perfurm.com / admin123")
    print("  Seller 1: seller1@example.com / seller123")
    print("  Seller 2: seller2@example.com / seller123")
    print("  Customer: customer@example.com / customer123")
    print("\n✨ You can now test the application with these accounts!")

if __name__ == "__main__":
    asyncio.run(seed_database())
