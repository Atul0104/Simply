import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Users, ShoppingBag, TrendingUp, LogOut, UserCheck, Bell, Home, Menu, Package, Percent, Ticket, Settings, Tag, CreditCard, Image, Eye, ShieldCheck, Truck, RotateCcw, MessageSquare, BarChart3 } from 'lucide-react';
import PlatformAnalytics from './admin/PlatformAnalytics';
import BroadcastNotifications from './admin/BroadcastNotifications';
import CouponManagement from './admin/CouponManagement';
import TicketManagement from './admin/TicketManagement';
import FooterManagement from './admin/FooterManagement';
import OfferCardsManagement from './admin/OfferCardsManagement';
import BankOffersManagement from './admin/BankOffersManagement';
import PlatformSettings from './admin/PlatformSettings';
import StorefrontSettings from './admin/StorefrontSettings';
import HeroBannerManagement from './admin/HeroBannerManagement';
import OrderManagement from './admin/OrderManagement';
import StaffManagement from './admin/StaffManagement';
import ServiceabilityManagement from './admin/ServiceabilityManagement';
import ProductMerchandising from './admin/ProductMerchandising';
import ReturnManagement from './admin/ReturnManagement';
import ReviewManagement from './admin/ReviewManagement';
import PrivacyManagement from './admin/PrivacyManagement';
import CreatorCampaignManagement from './admin/CreatorCampaignManagement';
import InventoryManagement from './admin/InventoryManagement';
import ProductsManagement from './seller/ProductsManagement';
import UserManagement from './admin/UserManagement';
import BrandMark from '@/components/BrandMark';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Common Header Component
function AdminHeader({ user, logout, navigate, adminView, setAdminView }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems = [
    { icon: Home, label: 'Home', path: '/', color: 'text-blue-600' },
    { icon: TrendingUp, label: 'Dashboard', path: '/admin', color: 'text-purple-600' },
    { divider: true, label: 'Management', icon: Users, iconColor: 'text-green-500' },
    { icon: ShoppingBag, label: 'Orders & Refunds', path: '/admin/orders', color: 'text-[#7d4956]', permission: 'orders.manage' },
    { icon: Users, label: 'User Management', path: '/admin/users', color: 'text-blue-700', permission: 'customers.read' },
    { icon: RotateCcw, label: 'Returns & Cancellations', path: '/admin/returns', color: 'text-rose-600', permission: 'orders.manage' },
    { icon: MessageSquare, label: 'Review Moderation', path: '/admin/reviews', color: 'text-amber-700', permission: 'reviews.manage' },
    { icon: ShieldCheck, label: 'Privacy Requests', path: '/admin/privacy', color: 'text-teal-700', permission: 'privacy.manage' },
    { icon: Package, label: 'Add & Edit Products', path: '/admin/products', color: 'text-fuchsia-700', permission: 'products.manage' },
    { icon: Package, label: 'Bottle Inventory', path: '/admin/inventory', color: 'text-emerald-700', permission: 'inventory.manage' },
    { icon: Eye, label: 'Catalogue Visibility', path: '/admin/catalogue', color: 'text-indigo-600', permission: 'products.manage' },
    { icon: Truck, label: 'Delivery Areas', path: '/admin/serviceability', color: 'text-sky-600', permission: 'shipping.manage' },
    { icon: ShieldCheck, label: 'Admin Staff', path: '/admin/staff', color: 'text-violet-600', permission: 'permissions.manage' },
    { icon: TrendingUp, label: 'Analytics', path: '/admin/analytics', color: 'text-indigo-600', permission: 'analytics.read' },
    { divider: true, label: 'Marketing', icon: Tag, iconColor: 'text-pink-500' },
    { icon: Bell, label: 'Notifications', path: '/admin/notifications', color: 'text-amber-600', permission: 'marketing.manage' },
    { icon: Percent, label: 'Coupons', path: '/admin/coupons', color: 'text-pink-600', permission: 'marketing.manage' },
    { icon: Tag, label: 'Offer Cards', path: '/admin/offers', color: 'text-red-600', permission: 'marketing.manage' },
    { icon: Image, label: 'Creator Campaigns', path: '/admin/creator-campaigns', color: 'text-fuchsia-600', permission: 'marketing.manage' },
    { icon: CreditCard, label: 'Bank Offers', path: '/admin/bank-offers', color: 'text-blue-500', permission: 'marketing.manage' },
    { icon: Image, label: 'Hero Banners', path: '/admin/banners', color: 'text-violet-600', permission: 'content.manage' },
    { divider: true, label: 'Settings', icon: Settings, iconColor: 'text-slate-500' },
    { icon: Eye, label: 'Visibility Control', path: '/admin/storefront', color: 'text-cyan-600', permission: 'content.manage' },
    { icon: Ticket, label: 'Support Tickets', path: '/admin/tickets', color: 'text-orange-600', permission: 'support.manage' },
    { icon: Package, label: 'Footer', path: '/admin/footer', color: 'text-gray-600', permission: 'content.manage' },
    { icon: Settings, label: 'Platform Settings', path: '/admin/settings', color: 'text-slate-600', permission: 'platform.manage' },
  ];
  const canAccess = (item) => !item.permission || user?.permissions?.includes('*') || user?.permissions?.includes(item.permission);
  const superModePaths = new Set(['/', '/admin', '/admin/users', '/admin/analytics', '/admin/staff', '/admin/settings', '/admin/privacy']);
  const modeAllows = item => item.divider || user?.admin_role !== 'super_admin' || adminView || superModePaths.has(item.path);

  return (
    <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
      <div className="w-full px-3 py-3 sm:px-5 lg:px-6">
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
                  <SheetTitle className="text-left">Admin Menu</SheetTitle>
                </SheetHeader>
                {user?.admin_role === 'super_admin' && <div className="mt-4 flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50 p-3"><div><p className="text-sm font-semibold text-violet-900">Admin operational view</p><p className="text-xs text-violet-700">Orders, finance, catalogue and CMS</p></div><Switch checked={adminView} onCheckedChange={setAdminView} /></div>}
                <div className="mt-4 flex-1 overflow-y-auto space-y-1 pb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                  {menuItems.filter(item => canAccess(item) && modeAllows(item)).map((item, idx) =>
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
              <div className="hidden sm:block"><BrandMark subtitle="Admin Portal" /></div>
              <div className="sm:hidden"><BrandMark compact /></div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {user?.admin_role === 'super_admin' && <div className="hidden items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 md:flex"><span className="text-xs font-semibold text-violet-800">Admin view</span><Switch checked={adminView} onCheckedChange={setAdminView} aria-label="Toggle Admin operational view" /></div>}
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

function AdminHome({ adminView, setAdminView }) {
  const [stats, setStats] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dashboardSections = [
    ['Overview', null, null, null, null, true],
    ['Dashboard', '/admin', TrendingUp, null, 'text-purple-600'],
    ['Commerce', null, null, null, null, true],
    ['Orders & refunds', '/admin/orders', ShoppingBag, 'orders.manage', 'text-[#7d4956]'], ['Returns & cancellations', '/admin/returns', RotateCcw, 'orders.manage', 'text-rose-600'],
    ['Add & edit products', '/admin/products', Package, 'products.manage', 'text-fuchsia-700'], ['Bottle inventory', '/admin/inventory', Package, 'inventory.manage', 'text-emerald-700'],
    ['Catalogue visibility', '/admin/catalogue', Eye, 'products.manage', 'text-indigo-600'],
    ['Marketing & CMS', null, null, null, null, true],
    ['Creator campaigns', '/admin/creator-campaigns', Image, 'marketing.manage', 'text-fuchsia-600'],
    ['Offer cards', '/admin/offers', Tag, 'marketing.manage', 'text-red-600'], ['Coupons', '/admin/coupons', Percent, 'marketing.manage', 'text-pink-600'],
    ['Bank offers', '/admin/bank-offers', CreditCard, 'marketing.manage', 'text-blue-600'], ['Notifications', '/admin/notifications', Bell, 'marketing.manage', 'text-amber-600'],
    ['Hero banners', '/admin/banners', Image, 'content.manage', 'text-violet-600'], ['Storefront visibility', '/admin/storefront', Eye, 'content.manage', 'text-cyan-600'],
    ['Footer content', '/admin/footer', Package, 'content.manage', 'text-stone-600'],
    ['Customer operations', null, null, null, null, true],
    ['User management', '/admin/users', Users, 'customers.read', 'text-blue-700'],
    ['Review moderation', '/admin/reviews', MessageSquare, 'reviews.manage', 'text-amber-700'],
    ['Support tickets', '/admin/tickets', Ticket, 'support.manage', 'text-orange-600'], ['Privacy requests', '/admin/privacy', ShieldCheck, 'privacy.manage', 'text-teal-700'],
    ['Delivery areas', '/admin/serviceability', Truck, 'shipping.manage', 'text-sky-600'],
    ['Insights & system', null, null, null, null, true],
    ['Business analytics', '/admin/analytics', BarChart3, 'analytics.read', 'text-indigo-600'],
    ['Admin departments', '/admin/staff', ShieldCheck, 'permissions.manage', 'text-violet-600'], ['Platform settings', '/admin/settings', Settings, 'platform.manage', 'text-slate-600'],
  ];
  const canUse = permission => !permission || user?.permissions?.includes('*') || user?.permissions?.includes(permission);
  const superModePaths = new Set(['/admin', '/admin/users', '/admin/analytics', '/admin/staff', '/admin/settings', '/admin/privacy']);
  const modeAllows = item => item[5] || user?.admin_role !== 'super_admin' || adminView || superModePaths.has(item[1]);
  const chartColors = ['#6f3b49', '#b7796f', '#d4a373', '#64748b', '#0f766e'];

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/analytics/admin`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader user={user} logout={logout} navigate={navigate} adminView={adminView} setAdminView={setAdminView} />

      <div className="flex w-full items-start">
        <aside className="sticky top-[65px] hidden h-[calc(100vh-65px)] w-72 shrink-0 overflow-y-auto border-r border-stone-200 bg-white p-3 lg:block" aria-label="Admin side panel">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Management panel</p>
          <nav className="space-y-1">{dashboardSections.filter(item => (item[5] || canUse(item[3])) && modeAllows(item)).map(([label, path, Icon, permission, iconColor, category], index) => {
            if (category) return <p key={`${label}-${index}`} className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400 first:pt-0">{label}</p>;
            const active = path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(path);
            return <button key={path} type="button" onClick={() => navigate(path)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${active ? 'bg-[#6f3b49] font-medium text-white shadow-sm' : 'text-stone-700 hover:bg-stone-100'}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active ? 'bg-white/15 text-white' : `bg-stone-50 ${iconColor}`}`}><Icon className="h-4 w-4" /></span><span>{label}</span></button>;
          })}</nav>
        </aside>

      {/* Stats */}
      <div className="min-w-0 flex-1 px-3 py-6 sm:px-5 lg:px-8">
        <div className="mb-4">
          <h2 className="text-2xl font-bold">Platform Overview</h2>
          <p className="text-gray-600">Manage the Perfurm fragrance marketplace</p>
        </div>

        {stats && (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card data-testid="stat-users" className="cursor-pointer transition-shadow hover:shadow-lg" onClick={() => navigate('/admin/users')}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="w-5 h-5 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_users}</div>
              </CardContent>
            </Card>

            <Card data-testid="stat-orders" className="cursor-pointer transition-shadow hover:shadow-lg" onClick={() => { if (user?.admin_role === 'super_admin' && !adminView) setAdminView(true); navigate('/admin/orders'); }}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <ShoppingBag className="w-5 h-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_orders}</div>
              </CardContent>
            </Card>

            <Card data-testid="stat-products" className="cursor-pointer transition-shadow hover:shadow-lg" onClick={() => { if (user?.admin_role === 'super_admin' && !adminView) setAdminView(true); navigate('/admin/products'); }}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                <ShoppingBag className="w-5 h-5 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_products}</div>
              </CardContent>
            </Card>

            <Card data-testid="stat-revenue" className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/admin/analytics')}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Platform Revenue</CardTitle>
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{stats.total_revenue.toFixed(2)}</div>
                <p className="text-xs text-blue-600 mt-1">Click for business analytics</p>
              </CardContent>
            </Card>
          </div>
        )}

        {stats && <div className="mb-6 grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2"><CardHeader><CardTitle>Six-month performance</CardTitle></CardHeader><CardContent><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.monthly_performance || []}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" /><YAxis yAxisId="orders" allowDecimals={false} /><YAxis yAxisId="revenue" orientation="right" tickFormatter={value => `₹${Math.round(value / 1000)}k`} /><Tooltip formatter={(value, name) => name === 'revenue' ? [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue'] : [value, 'Orders']} /><Legend /><Bar yAxisId="orders" dataKey="orders" name="Orders" fill="#6f3b49" radius={[5,5,0,0]} /><Bar yAxisId="revenue" dataKey="revenue" name="Revenue" fill="#d4a373" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div></CardContent></Card>
          <Card><CardHeader><CardTitle>Order status</CardTitle></CardHeader><CardContent>{stats.order_statuses?.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.order_statuses} dataKey="count" nameKey="status" innerRadius={52} outerRadius={82} paddingAngle={3}>{stats.order_statuses.map((entry, index) => <Cell key={entry.status} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip /><Legend verticalAlign="bottom" /></PieChart></ResponsiveContainer></div> : <div className="grid h-72 place-items-center rounded-xl border border-dashed text-center text-sm text-stone-500">Order distribution will appear after the first order.</div>}</CardContent></Card>
        </div>}

        {/* Quick Actions */}
        <Card className={user?.admin_role === 'super_admin' && !adminView ? 'hidden' : ''}>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <Button
                onClick={() => navigate('/admin/orders')}
                className="w-full justify-start bg-green-600 hover:bg-green-700"
                data-testid="quick-orders"
              >
                <ShoppingBag className="w-4 h-4 mr-2" /> Manage Orders
              </Button>
              <Button
                onClick={() => navigate('/admin/notifications')}
                variant="outline"
                className="w-full justify-start border-amber-200 text-amber-700 hover:bg-amber-50"
                data-testid="quick-send-notification"
              >
                <Bell className="w-4 h-4 mr-2" /> Send Notification
              </Button>
              <Button
                onClick={() => navigate('/admin/storefront')}
                variant="outline"
                className="w-full justify-start border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                data-testid="quick-storefront"
              >
                <Eye className="w-4 h-4 mr-2" /> Visibility Control
              </Button>
              <Button
                onClick={() => navigate('/admin/banners')}
                variant="outline"
                className="w-full justify-start border-violet-200 text-violet-700 hover:bg-violet-50"
                data-testid="quick-banners"
              >
                <Image className="w-4 h-4 mr-2" /> Hero Banners
              </Button>
              <Button
                onClick={() => navigate('/admin/offers')}
                variant="outline"
                className="w-full justify-start border-red-200 text-red-700 hover:bg-red-50"
                data-testid="quick-offers"
              >
                <Tag className="w-4 h-4 mr-2" /> Offer Cards
              </Button>
              <Button onClick={() => navigate('/admin/creator-campaigns')} variant="outline" className="w-full justify-start border-fuchsia-200 text-fuchsia-700 hover:bg-fuchsia-50" data-testid="quick-campaigns"><Image className="mr-2 h-4 w-4" /> Creator Campaigns</Button>
              <Button
                onClick={() => navigate('/admin/coupons')}
                variant="outline"
                className="w-full justify-start border-pink-200 text-pink-700 hover:bg-pink-50"
                data-testid="quick-coupons"
              >
                <Percent className="w-4 h-4 mr-2" /> Coupons
              </Button>
              <Button
                onClick={() => navigate('/admin/settings')}
                variant="outline"
                className="w-full justify-start border-slate-200 text-slate-700 hover:bg-slate-50"
                data-testid="quick-settings"
              >
                <Settings className="w-4 h-4 mr-2" /> Platform Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [adminView, setAdminView] = useState(false);
  return (
    <Routes>
      <Route path="/" element={<AdminHome adminView={adminView} setAdminView={setAdminView} />} />
      <Route path="/analytics" element={<PlatformAnalytics />} />
      <Route path="/notifications" element={<BroadcastNotifications />} />
      <Route path="/coupons" element={<CouponManagement />} />
      <Route path="/tickets" element={<TicketManagement />} />
      <Route path="/offers" element={<OfferCardsManagement />} />
      <Route path="/creator-campaigns" element={<CreatorCampaignManagement />} />
      <Route path="/bank-offers" element={<BankOffersManagement />} />
      <Route path="/footer" element={<FooterManagement />} />
      <Route path="/settings" element={<PlatformSettings />} />
      <Route path="/sellers" element={<AdminHome adminView={adminView} setAdminView={setAdminView} />} />
      <Route path="/payouts" element={<PlatformAnalytics />} />
      <Route path="/orders" element={<OrderManagement />} />
      <Route path="/returns" element={<ReturnManagement />} />
      <Route path="/reviews" element={<ReviewManagement />} />
      <Route path="/privacy" element={<PrivacyManagement />} />
      <Route path="/catalogue" element={<ProductMerchandising />} />
      <Route path="/products" element={<ProductsManagement adminMode />} />
      <Route path="/inventory" element={<InventoryManagement />} />
      <Route path="/users" element={<UserManagement />} />
      <Route path="/serviceability" element={<ServiceabilityManagement />} />
      <Route path="/staff" element={<StaffManagement />} />
      <Route path="/storefront" element={<StorefrontSettings />} />
      <Route path="/banners" element={<HeroBannerManagement />} />
    </Routes>
  );
}
