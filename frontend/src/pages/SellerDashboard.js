import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, ShoppingBag, TrendingUp, LogOut, Plus, Settings, Home, Menu, Bell, Wallet, Store, BarChart3, Boxes, Warehouse, Shield, RotateCcw, Truck } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import SellerSetup from './seller/SellerSetup';
import ProductsManagement from './seller/ProductsManagement';
import InventoryManagement from './seller/InventoryManagement';
import OrdersManagement from './seller/OrdersManagement';
import Analytics from './seller/Analytics';
import WarehouseManagement from './seller/WarehouseManagement';
import BusinessVerification from './seller/BusinessVerification';
import SellerPerformance from './seller/SellerPerformance';
import ReturnPolicySettings from './seller/ReturnPolicySettings';
import StoreManagement from './seller/StoreManagement';
import PayoutHistory from './seller/PayoutHistory';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Common Header Component
function DashboardHeader({ user, logout, navigate, title, subtitle }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems = [
    { icon: Home, label: 'Home', path: '/', color: 'text-blue-600' },
    { icon: TrendingUp, label: 'Dashboard', path: '/seller', color: 'text-purple-600' },
    { divider: true, label: 'Products', icon: Package, iconColor: 'text-indigo-500' },
    { icon: Package, label: 'Products', path: '/seller/products', color: 'text-indigo-600' },
    { icon: Plus, label: 'Add Product', path: '/seller/products/add', color: 'text-green-600' },
    { icon: Boxes, label: 'Inventory', path: '/seller/inventory', color: 'text-amber-600' },
    { divider: true, label: 'Orders & Payments', icon: ShoppingBag, iconColor: 'text-pink-500' },
    { icon: ShoppingBag, label: 'Orders', path: '/seller/orders', color: 'text-pink-600' },
    { icon: Wallet, label: 'Payouts', path: '/seller/payouts', color: 'text-emerald-600' },
    { icon: BarChart3, label: 'Analytics', path: '/seller/analytics', color: 'text-cyan-600' },
    { divider: true, label: 'Store', icon: Store, iconColor: 'text-violet-500' },
    { icon: Store, label: 'Store Management', path: '/seller/store', color: 'text-violet-600' },
    { icon: Warehouse, label: 'Warehouses', path: '/seller/warehouses', color: 'text-orange-600' },
    { icon: RotateCcw, label: 'Return Policy', path: '/seller/return-policy', color: 'text-red-600' },
    { divider: true, label: 'Account', icon: Shield, iconColor: 'text-teal-500' },
    { icon: TrendingUp, label: 'Performance', path: '/seller/performance', color: 'text-blue-500' },
    { icon: Shield, label: 'Verification', path: '/seller/business-verification', color: 'text-teal-600' },
  ];

  return (
    <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="menu-btn">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 overflow-hidden flex flex-col">
                <SheetHeader>
                  <SheetTitle className="text-left">Seller Menu</SheetTitle>
                </SheetHeader>
                <div className="mt-4 flex-1 overflow-y-auto space-y-1 pb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                  {menuItems.map((item, idx) => 
                    item.divider ? (
                      <div key={idx} className="pt-4 pb-2 px-3 flex items-center gap-2">
                        {item.icon && <item.icon className={`w-4 h-4 ${item.iconColor || 'text-gray-400'}`} />}
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{item.label}</p>
                      </div>
                    ) : (
                      <Button
                        key={idx}
                        variant="ghost"
                        className="w-full justify-start gap-3 hover:bg-gray-100"
                        onClick={() => { navigate(item.path); setMenuOpen(false); }}
                      >
                        <item.icon className={`w-5 h-5 ${item.color}`} />
                        <span>{item.label}</span>
                      </Button>
                    )
                  )}
                </div>
              </SheetContent>
            </Sheet>
            
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => navigate('/')}
              data-testid="brand-logo"
            >
              <Package className="w-8 h-8 text-blue-600" />
              <div className="hidden sm:block">
                <p className="font-bold text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Black Money
                </p>
                <p className="text-xs text-gray-500">{subtitle}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              title="Go to Home"
              data-testid="home-btn"
            >
              <Home className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" data-testid="notifications-btn">
              <Bell className="w-5 h-5" />
            </Button>
            <Button variant="ghost" onClick={logout} data-testid="logout-btn" className="hidden sm:flex">
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} className="sm:hidden" data-testid="logout-btn-mobile">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

function SellerHome() {
  const [seller, setSeller] = useState(null);
  const [stats, setStats] = useState({ products: 0, orders: 0, revenue: 0 });
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchSellerProfile();
    fetchStats();
  }, []);

  const fetchSellerProfile = async () => {
    try {
      const response = await axios.get(`${API_URL}/sellers/me`);
      setSeller(response.data);
    } catch (error) {
      if (error.response?.status === 404) {
        navigate('/seller/setup');
      }
    }
  };

  const fetchStats = async () => {
    try {
      const [products, orders, analytics] = await Promise.all([
        axios.get(`${API_URL}/products`, { params: { seller_id: user.id } }),
        axios.get(`${API_URL}/orders/my`),
        axios.get(`${API_URL}/analytics/seller`)
      ]);
      
      setStats({
        products: products.data.length,
        orders: orders.data.length,
        revenue: analytics.data.total_revenue || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  if (!seller) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (seller.status === 'pending') {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader user={user} logout={logout} navigate={navigate} subtitle="Seller Portal" />
        <div className="flex items-center justify-center min-h-[80vh]">
          <Card className="max-w-md">
            <CardContent className="p-6 text-center">
              <Package className="w-16 h-16 mx-auto text-blue-500 mb-4" />
              <h2 className="text-2xl font-bold mb-2">Application Under Review</h2>
              <p className="text-gray-600">Your seller application is being reviewed by our team. You'll be notified once approved.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (seller.status === 'rejected') {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader user={user} logout={logout} navigate={navigate} subtitle="Seller Portal" />
        <div className="flex items-center justify-center min-h-[80vh]">
          <Card className="max-w-md">
            <CardContent className="p-6 text-center">
              <p className="text-red-600 mb-4">Your seller application was not approved. Please contact support for more information.</p>
              <Button onClick={() => navigate('/')}>Go to Home</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader user={user} logout={logout} navigate={navigate} subtitle="Seller Portal" />

      {/* Navigation */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <Button variant="default" onClick={() => navigate('/seller')} data-testid="nav-home">Dashboard</Button>
            <Button variant="ghost" onClick={() => navigate('/seller/products')} data-testid="nav-products">Products</Button>
            <Button variant="ghost" onClick={() => navigate('/seller/inventory')} data-testid="nav-inventory">Inventory</Button>
            <Button variant="ghost" onClick={() => navigate('/seller/orders')} data-testid="nav-orders">Orders</Button>
            <Button variant="ghost" onClick={() => navigate('/seller/analytics')} data-testid="nav-analytics">Analytics</Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-4">
          <h2 className="text-2xl font-bold">{seller.business_name}</h2>
          <p className="text-gray-600">Welcome to your seller dashboard</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card data-testid="stat-products">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.products}</div>
            </CardContent>
          </Card>

          <Card data-testid="stat-orders">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <ShoppingBag className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.orders}</div>
            </CardContent>
          </Card>

          <Card data-testid="stat-revenue">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{stats.revenue.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <Button onClick={() => navigate('/seller/products')} className="w-full justify-start" data-testid="quick-add-product">
                <Plus className="w-4 h-4 mr-2" /> Add New Product
              </Button>
              <Button onClick={() => navigate('/seller/orders')} variant="outline" className="w-full justify-start" data-testid="quick-view-orders">
                <ShoppingBag className="w-4 h-4 mr-2" /> View Orders
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SellerDashboard() {
  return (
    <Routes>
      <Route path="/" element={<SellerHome />} />
      <Route path="/setup" element={<SellerSetup />} />
      <Route path="/products" element={<ProductsManagement />} />
      <Route path="/inventory" element={<InventoryManagement />} />
      <Route path="/orders" element={<OrdersManagement />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/payouts" element={<PayoutHistory />} />
      <Route path="/warehouses" element={<WarehouseManagement />} />
      <Route path="/business-verification" element={<BusinessVerification />} />
      <Route path="/performance" element={<SellerPerformance />} />
      <Route path="/return-policy" element={<ReturnPolicySettings />} />
      <Route path="/store" element={<StoreManagement />} />
    </Routes>
  );
}
