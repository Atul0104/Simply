import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Package, Truck } from 'lucide-react';
import { format } from 'date-fns';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  packed: 'bg-purple-100 text-purple-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  out_for_delivery: 'bg-cyan-100 text-cyan-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  returned: 'bg-orange-100 text-orange-800',
  refunded: 'bg-gray-100 text-gray-800'
};

export default function MyOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API_URL}/orders/my`);
      setOrders(response.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="mb-4">Please login to view your orders</p>
            <Button onClick={() => navigate('/auth')}>Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-4" data-testid="back-btn">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
        </Button>
        
        <h1 className="text-3xl font-bold mb-6">My Orders</h1>
        
        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">No orders yet</p>
              <Button onClick={() => navigate('/')}>Start Shopping</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id} data-testid={`order-${order.id}`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-sm text-gray-500">Order ID</p>
                      <p className="font-mono font-semibold">{order.id}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {format(new Date(order.created_at), 'PPP')}
                      </p>
                    </div>
                    <Badge className={statusColors[order.status] || 'bg-gray-100'}>
                      {order.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.name} x {item.quantity}</span>
                        <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>Total</span>
                    <span>₹{order.total_amount.toFixed(2)}</span>
                  </div>
                  
                  <div className="mt-4 text-sm text-gray-600">
                    <p className="font-semibold mb-1">Shipping Address:</p>
                    <p>{order.shipping_address.name}</p>
                    <p>{order.shipping_address.address_line}</p>
                    <p>{order.shipping_address.city}, {order.shipping_address.state} - {order.shipping_address.pincode}</p>
                    <p>{order.shipping_address.phone}</p>
                  </div>

                  {order.tracking_id && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-900">Tracking ID:</p>
                        <p className="font-mono text-sm">{order.tracking_id}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => navigate(`/customer/orders/${order.id}/track`)}
                        className="gap-2"
                      >
                        <Truck className="w-4 h-4" />
                        Track Order
                      </Button>
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    {order.status === 'delivered' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/customer/orders/${order.id}/return`)}
                        className="flex-1"
                      >
                        Return/Replace
                      </Button>
                    )}
                    {['pending', 'confirmed'].includes(order.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/customer/orders/${order.id}/return`)}
                        className="flex-1 text-red-500 hover:text-red-600"
                      >
                        Cancel Order
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
