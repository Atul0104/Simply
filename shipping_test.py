#!/usr/bin/env python3
"""
Shipping Label Generation Flow Test
Tests the complete shipping label generation workflow including:
1. Seller login and warehouse management
2. Customer order creation
3. Shipping label generation
"""

import requests
import json
import sys
import os
from datetime import datetime
import time

# Get backend URL from environment
BACKEND_URL = "https://cart-duplication-fix.preview.emergentagent.com/api"

class ShippingFlowTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.seller_token = None
        self.customer_token = None
        self.test_results = []
        self.seller_id = None
        self.customer_id = None
        self.warehouse_id = None
        self.order_id = None
        self.product_id = None
        
    def log_result(self, test_name, success, message, response_data=None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if not success and response_data:
            print(f"   Response: {response_data}")
    
    def login_seller(self):
        """Login as seller1@example.com"""
        try:
            url = f"{self.base_url}/auth/login"
            data = {
                "email": "seller1@example.com",
                "password": "seller123"
            }
            
            response = requests.post(url, json=data)
            
            if response.status_code == 200:
                result = response.json()
                self.seller_token = result.get("access_token")
                user_data = result.get("user", {})
                self.log_result("Seller Login", True, f"Seller logged in successfully: {user_data.get('name', 'Unknown')}")
                return True
            else:
                self.log_result("Seller Login", False, f"Failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Seller Login", False, f"Exception: {str(e)}")
            return False
    
    def login_customer(self):
        """Login as customer@example.com"""
        try:
            url = f"{self.base_url}/auth/login"
            data = {
                "email": "customer@example.com",
                "password": "customer123"
            }
            
            response = requests.post(url, json=data)
            
            if response.status_code == 200:
                result = response.json()
                self.customer_token = result.get("access_token")
                user_data = result.get("user", {})
                self.customer_id = user_data.get("id")
                self.log_result("Customer Login", True, f"Customer logged in successfully: {user_data.get('name', 'Unknown')}")
                return True
            else:
                self.log_result("Customer Login", False, f"Failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Customer Login", False, f"Exception: {str(e)}")
            return False
    
    def get_seller_warehouses(self):
        """Test GET /api/warehouses for seller"""
        if not self.seller_token:
            self.log_result("Get Seller Warehouses", False, "No seller token available")
            return False
            
        try:
            url = f"{self.base_url}/warehouses"
            headers = {"Authorization": f"Bearer {self.seller_token}"}
            
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200:
                warehouses = response.json()
                if isinstance(warehouses, list):
                    if len(warehouses) > 0:
                        self.warehouse_id = warehouses[0].get("id")
                        self.log_result("Get Seller Warehouses", True, f"Found {len(warehouses)} warehouses", {"warehouse_count": len(warehouses), "first_warehouse_id": self.warehouse_id})
                    else:
                        self.log_result("Get Seller Warehouses", True, "No warehouses found (empty list returned)")
                    return True
                else:
                    self.log_result("Get Seller Warehouses", False, "Response is not a list", warehouses)
                    return False
            else:
                self.log_result("Get Seller Warehouses", False, f"Failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Get Seller Warehouses", False, f"Exception: {str(e)}")
            return False
    
    def get_seller_orders(self):
        """Test GET /api/orders/my for seller"""
        if not self.seller_token:
            self.log_result("Get Seller Orders", False, "No seller token available")
            return False
            
        try:
            url = f"{self.base_url}/orders/my"
            headers = {"Authorization": f"Bearer {self.seller_token}"}
            
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200:
                orders = response.json()
                if isinstance(orders, list):
                    self.log_result("Get Seller Orders", True, f"Retrieved {len(orders)} orders", {"order_count": len(orders)})
                    return True
                else:
                    self.log_result("Get Seller Orders", False, "Response is not a list", orders)
                    return False
            else:
                self.log_result("Get Seller Orders", False, f"Failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Get Seller Orders", False, f"Exception: {str(e)}")
            return False
    
    def create_customer_address(self):
        """Test POST /api/addresses for customer"""
        if not self.customer_token:
            self.log_result("Create Customer Address", False, "No customer token available")
            return False
            
        try:
            url = f"{self.base_url}/addresses"
            headers = {"Authorization": f"Bearer {self.customer_token}"}
            data = {
                "name": "John Doe",
                "phone": "9876543210",
                "pincode": "560001",
                "address_line1": "123 Main Street",
                "city": "Bangalore",
                "state": "Karnataka",
                "address_type": "home"
            }
            
            response = requests.post(url, json=data, headers=headers)
            
            if response.status_code == 200 or response.status_code == 201:
                address = response.json()
                self.log_result("Create Customer Address", True, "Address created successfully", address)
                return True
            else:
                self.log_result("Create Customer Address", False, f"Failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Create Customer Address", False, f"Exception: {str(e)}")
            return False
    
    def get_seller_products(self):
        """Get products from seller1 to use in order creation"""
        try:
            # First get seller profile to get seller_id
            url = f"{self.base_url}/sellers/me"
            headers = {"Authorization": f"Bearer {self.seller_token}"}
            
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200:
                seller_profile = response.json()
                self.seller_id = seller_profile.get("id")
                
                # Now get products for this seller
                products_url = f"{self.base_url}/products?seller_id={self.seller_id}"
                products_response = requests.get(products_url)
                
                if products_response.status_code == 200:
                    products = products_response.json()
                    if isinstance(products, list) and len(products) > 0:
                        self.product_id = products[0].get("id")
                        self.log_result("Get Seller Products", True, f"Found {len(products)} products from seller", {"product_count": len(products), "first_product_id": self.product_id})
                        return True
                    else:
                        self.log_result("Get Seller Products", True, "No products found for seller")
                        return True
                else:
                    self.log_result("Get Seller Products", False, f"Failed to get products: {products_response.status_code}", products_response.text)
                    return False
            else:
                self.log_result("Get Seller Products", False, f"Failed to get seller profile: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Get Seller Products", False, f"Exception: {str(e)}")
            return False
    
    def create_order(self):
        """Test POST /api/orders with cart items from seller1's products"""
        if not self.customer_token:
            self.log_result("Create Order", False, "No customer token available")
            return False
        
        if not self.product_id or not self.seller_id:
            self.log_result("Create Order", False, "No product or seller ID available")
            return False
            
        try:
            url = f"{self.base_url}/orders"
            headers = {"Authorization": f"Bearer {self.customer_token}"}
            data = {
                "items": [
                    {
                        "product_id": self.product_id,
                        "seller_id": self.seller_id,
                        "name": "Test Product",
                        "price": 100.0,
                        "quantity": 1
                    }
                ],
                "total_amount": 100.0,
                "shipping_address": {
                    "name": "John Doe",
                    "phone": "9876543210",
                    "pincode": "560001",
                    "address_line1": "123 Main Street",
                    "city": "Bangalore",
                    "state": "Karnataka"
                }
            }
            
            response = requests.post(url, json=data, headers=headers)
            
            if response.status_code == 200 or response.status_code == 201:
                order = response.json()
                self.order_id = order.get("id")
                self.log_result("Create Order", True, f"Order created successfully: {self.order_id}", order)
                return True
            else:
                self.log_result("Create Order", False, f"Failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Create Order", False, f"Exception: {str(e)}")
            return False
    
    def generate_shipping_label(self):
        """Test POST /api/shipping-labels with order_id and warehouse_id"""
        if not self.seller_token:
            self.log_result("Generate Shipping Label", False, "No seller token available")
            return False
        
        if not self.order_id:
            self.log_result("Generate Shipping Label", False, "No order ID available")
            return False
        
        if not self.warehouse_id:
            self.log_result("Generate Shipping Label", False, "No warehouse ID available")
            return False
            
        try:
            url = f"{self.base_url}/shipping-labels"
            headers = {"Authorization": f"Bearer {self.seller_token}"}
            data = {
                "order_id": self.order_id,
                "warehouse_id": self.warehouse_id
            }
            
            response = requests.post(url, json=data, headers=headers)
            
            if response.status_code == 200 or response.status_code == 201:
                label = response.json()
                self.log_result("Generate Shipping Label", True, f"Shipping label generated successfully", label)
                return True
            else:
                self.log_result("Generate Shipping Label", False, f"Failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Generate Shipping Label", False, f"Exception: {str(e)}")
            return False
    
    def run_shipping_flow_test(self):
        """Run the complete shipping label generation flow test"""
        print(f"🚀 Starting Shipping Label Generation Flow Test")
        print(f"Backend URL: {self.base_url}")
        print("=" * 80)
        
        tests_passed = 0
        total_tests = 8
        
        # Step 1: Login as seller
        if self.login_seller():
            tests_passed += 1
        
        # Step 2: Check warehouses for seller
        if self.get_seller_warehouses():
            tests_passed += 1
        
        # Step 3: Get seller's orders
        if self.get_seller_orders():
            tests_passed += 1
        
        # Step 4: Login as customer
        if self.login_customer():
            tests_passed += 1
        
        # Step 5: Create customer address
        if self.create_customer_address():
            tests_passed += 1
        
        # Step 6: Get seller products (needed for order creation)
        if self.get_seller_products():
            tests_passed += 1
        
        # Step 7: Create order with seller's products
        if self.create_order():
            tests_passed += 1
        
        # Step 8: Generate shipping label (login as seller again is automatic via token)
        if self.generate_shipping_label():
            tests_passed += 1
        
        print("=" * 80)
        print(f"📊 Test Summary: {tests_passed}/{total_tests} tests passed")
        
        if tests_passed == total_tests:
            print("🎉 All shipping flow tests passed!")
            return True
        else:
            print("⚠️  Some tests failed. Check details above.")
            return False

def main():
    """Main function to run shipping flow tests"""
    tester = ShippingFlowTester()
    success = tester.run_shipping_flow_test()
    
    # Print detailed results
    print("\n" + "=" * 60)
    print("📋 Detailed Test Results:")
    for result in tester.test_results:
        status = "✅" if result["success"] else "❌"
        print(f"{status} {result['test']}: {result['message']}")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())