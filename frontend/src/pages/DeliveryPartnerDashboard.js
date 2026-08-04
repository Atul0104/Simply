import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Truck, Package, CheckCircle, Clock, MapPin, Phone, User, LogOut, 
  Bell, Home, Navigation, AlertCircle, Search, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  packed: 'bg-purple-100 text-purple-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  out_for_delivery: 'bg-cyan-100 text-cyan-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800'
};

const deliveryStatusOptions = [
  { value: 'picked_up', label: 'Picked Up', icon: Package },
  { value: 'in_transit', label: 'In Transit', icon: Truck },
  { value: 'out_for_delivery', label: 'Out for Delivery', icon: Navigation },
  { value: 'delivered', label: 'Delivered', icon: CheckCircle },
  { value: 'failed', label: 'Delivery Failed', icon: AlertCircle }
];

function Dashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inTransit: 0,
    delivered: 0
  });
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Update status dialog
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState({
    status: '',
    location: '',
    remarks: ''
  });

  useEffect(() => {
    fetchOrders();
    fetchProfile();
    fetchNotifications();
  }, []);

  const fetchOrders = async () => {
    try {
      const authToken = token || localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/delivery-partner/orders`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setOrders(response.data);
      
      // Calculate stats
      const total = response.data.length;
      const pending = response.data.filter(o => ['pending', 'confirmed', 'packed'].includes(o.status)).length;
      const inTransit = response.data.filter(o => ['shipped', 'out_for_delivery'].includes(o.status)).length;
      const delivered = response.data.filter(o => o.status === 'delivered').length;
      
      setStats({ total, pending, inTransit, delivered });
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const authToken = token || localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/delivery-partners/my`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setProfile(response.data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const authToken = token || localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/notifications/my`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setNotifications(response.data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleUpdateStatus = async () => {
    if (!statusUpdate.status) {
      toast.error('Please select a status');
      return;
    }

    try {
      const authToken = token || localStorage.getItem('token');
      await axios.post(
        `${API_URL}/delivery-status/${selectedOrder.id}`,
        statusUpdate,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      toast.success('Delivery status updated successfully!');
      setShowStatusDialog(false);
      setStatusUpdate({ status: '', location: '', remarks: '' });
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update status');
    }
  };

  const openStatusDialog = (order) => {
    setSelectedOrder(order);
    setShowStatusDialog(true);
  };

  const filteredOrders = orders.filter(order => {
    const matchesFilter = filter === 'all' || 
      (filter === 'pending' && ['pending', 'confirmed', 'packed'].includes(order.status)) ||
      (filter === 'in_transit' && ['shipped', 'out_for_delivery'].includes(order.status)) ||
      (filter === 'delivered' && order.status === 'delivered');
    
    const matchesSearch = !searchTerm || 
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.tracking_id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const unreadNotifications = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Truck className="w-8 h-8" />
              <div>
                <h1 className="text-xl font-bold">Delivery Partner</h1>
                <p className="text-sm text-green-100">{profile?.company_name || user?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="text-white relative">
                <Bell className="w-5 h-5" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {unreadNotifications}
                  </span>
                )}
              </Button>
              <Button variant="ghost" onClick={logout} className="text-white">
                <LogOut className="w-5 h-5 mr-2" /> Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Orders</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pending Pickup</p>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-full">
                  <Truck className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">In Transit</p>
                  <p className="text-2xl font-bold">{stats.inTransit}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Delivered</p>
                  <p className="text-2xl font-bold">{stats.delivered}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by Order ID or Tracking ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilter('all')}
                  size="sm"
                >
                  All
                </Button>
                <Button
                  variant={filter === 'pending' ? 'default' : 'outline'}
                  onClick={() => setFilter('pending')}
                  size="sm"
                >
                  Pending
                </Button>
                <Button
                  variant={filter === 'in_transit' ? 'default' : 'outline'}
                  onClick={() => setFilter('in_transit')}
                  size="sm"
                >
                  In Transit
                </Button>
                <Button
                  variant={filter === 'delivered' ? 'default' : 'outline'}
                  onClick={() => setFilter('delivered')}
                  size="sm"
                >
                  Delivered
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        <h2 className="text-xl font-bold mb-4">Assigned Orders</h2>
        
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No orders found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <Card key={order.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-mono font-semibold">#{order.id.slice(0, 8)}</p>
                        <Badge className={statusColors[order.status] || 'bg-gray-100'}>
                          {order.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                      
                      {order.tracking_id && (
                        <p className="text-sm text-gray-500 mb-2">
                          <span className="font-medium">Tracking:</span> {order.tracking_id}
                        </p>
                      )}
                      
                      {/* Shipping Address */}
                      <div className="bg-gray-50 p-3 rounded-lg mb-3">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-gray-400 mt-1" />
                          <div>
                            <p className="font-medium">{order.shipping_address?.name}</p>
                            <p className="text-sm text-gray-600">
                              {order.shipping_address?.address_line}, {order.shipping_address?.city}
                            </p>
                            <p className="text-sm text-gray-600">
                              {order.shipping_address?.state} - {order.shipping_address?.pincode}
                            </p>
                            <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                              <Phone className="w-3 h-3" /> {order.shipping_address?.phone}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{order.items?.length || 0} item(s)</span>
                        <span>₹{order.total_amount?.toFixed(2)}</span>
                        <span>{format(new Date(order.created_at), 'MMM dd, yyyy')}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <Button 
                        onClick={() => openStatusDialog(order)}
                        className="gap-2"
                        disabled={order.status === 'delivered' || order.status === 'cancelled'}
                      >
                        <Navigation className="w-4 h-4" />
                        Update Status
                      </Button>
                      
                      {order.shipping_address?.phone && (
                        <Button 
                          variant="outline"
                          onClick={() => window.open(`tel:${order.shipping_address.phone}`)}
                          className="gap-2"
                        >
                          <Phone className="w-4 h-4" />
                          Call Customer
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Update Status Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Delivery Status</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Status *</label>
              <div className="grid grid-cols-2 gap-2">
                {deliveryStatusOptions.map(({ value, label, icon: Icon }) => (
                  <div
                    key={value}
                    onClick={() => setStatusUpdate({ ...statusUpdate, status: value })}
                    className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-all ${
                      statusUpdate.status === value
                        ? 'border-green-500 bg-green-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${statusUpdate.status === value ? 'text-green-600' : 'text-gray-400'}`} />
                    <span className="text-sm">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Current Location</label>
              <Input
                placeholder="e.g., Near City Mall, Main Road"
                value={statusUpdate.location}
                onChange={(e) => setStatusUpdate({ ...statusUpdate, location: e.target.value })}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Remarks (Optional)</label>
              <Textarea
                placeholder="Any additional notes..."
                value={statusUpdate.remarks}
                onChange={(e) => setStatusUpdate({ ...statusUpdate, remarks: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateStatus} className="bg-green-600 hover:bg-green-700">
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DeliveryPartnerDashboard() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/*" element={<Dashboard />} />
    </Routes>
  );
}
