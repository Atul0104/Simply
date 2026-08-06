import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, Package, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

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
  const [invoiceLoading, setInvoiceLoading] = useState('');

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

  const downloadInvoice = async (order) => {
    setInvoiceLoading(order.id);
    try {
      await axios.post(`${API_URL}/orders/${order.id}/invoices`);
      const response = await axios.get(`${API_URL}/orders/${order.id}/invoice-download`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `perfurm-invoice-${order.id}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Invoice downloaded');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invoice is not available yet');
    } finally {
      setInvoiceLoading('');
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
      <div className="max-w-5xl mx-auto px-3 py-4 sm:px-4 sm:py-6">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-4" data-testid="back-btn">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
        </Button>
        
        <h1 className="mb-5 text-2xl font-bold sm:mb-6 sm:text-3xl">My Orders</h1>
        
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
                <CardContent className="p-3 sm:p-4">
                  <div className="mb-4 flex flex-col items-start gap-2 min-[420px]:flex-row min-[420px]:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-500">Order ID</p>
                      <p className="break-all font-mono text-sm font-semibold sm:text-base">{order.id}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {format(new Date(order.created_at), 'PPP')}
                      </p>
                    </div>
                    <Badge className={statusColors[order.status] || 'bg-gray-100'}>
                      {order.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="mb-4 space-y-3">
                    {order.items.map((item, idx) => (
                      <div key={`${item.product_id}-${item.variant_id || idx}`} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-2.5 sm:p-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-stone-100 sm:h-20 sm:w-20">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="grid h-full w-full place-items-center"><Package className="h-7 w-7 text-stone-400" /></div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <button type="button" onClick={() => navigate(`/product/${item.product_id}`)} className="text-left font-semibold text-stone-900 hover:text-[#6f3b49] hover:underline">
                            {item.name}
                          </button>
                          <p className="mt-1 text-xs text-stone-500">{item.size || 'Standard bottle'} · Qty {item.quantity}</p>
                          <p className="mt-1 text-sm font-semibold text-[#6f3b49]">₹{(item.price * item.quantity).toFixed(2)}</p>
                        </div>
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
                    <div className="mt-4 flex flex-col gap-3 rounded-lg bg-blue-50 p-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-blue-900">Tracking ID:</p>
                        <p className="break-all font-mono text-sm">{order.tracking_id}</p>
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

                  <div className="mt-4 flex flex-col gap-2 min-[420px]:flex-row min-[420px]:flex-wrap">
                    {!['pending', 'payment_pending', 'payment_failed', 'cancelled'].includes(order.status) && (
                      <Button variant="outline" size="sm" onClick={() => downloadInvoice(order)} disabled={invoiceLoading === order.id} className="flex-1">
                        <Download className="w-4 h-4 mr-2" />
                        {invoiceLoading === order.id ? 'Preparing…' : 'Invoice'}
                      </Button>
                    )}
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
