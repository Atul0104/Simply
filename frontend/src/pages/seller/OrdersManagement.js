import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Truck, Package, Barcode, FileText, Download } from 'lucide-react';
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
  cancelled: 'bg-red-100 text-red-800',
  returned: 'bg-orange-100 text-orange-800',
  refunded: 'bg-gray-100 text-gray-800'
};

export default function OrdersManagement() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deliveryPartners, setDeliveryPartners] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [labelData, setLabelData] = useState({
    delivery_partner_id: 'none',
    warehouse_id: '',
    weight: '',
    dimensions: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
    fetchDeliveryPartners();
    fetchWarehouses();
  }, []);

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

  const fetchDeliveryPartners = async () => {
    try {
      const response = await axios.get(`${API_URL}/delivery-partners`);
      setDeliveryPartners(response.data);
    } catch (error) {
      console.error('Error fetching delivery partners:', error);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const response = await axios.get(`${API_URL}/warehouses`);
      setWarehouses(response.data);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await axios.put(`${API_URL}/orders/${orderId}/status`, null, {
        params: { status: newStatus }
      });
      toast.success('Order status updated!');
      fetchOrders();
    } catch (error) {
      toast.error('Failed to update order status');
    }
  };

  const generateShippingLabel = async () => {
    if (!labelData.warehouse_id) {
      toast.error('Please select a warehouse');
      return;
    }

    try {
      const response = await axios.post(
        `${API_URL}/shipping-labels`,
        {
          order_id: selectedOrder.id,
          delivery_partner_id: labelData.delivery_partner_id === 'none' ? null : labelData.delivery_partner_id || null,
          warehouse_id: labelData.warehouse_id,
          weight: labelData.weight ? parseFloat(labelData.weight) : null,
          dimensions: labelData.dimensions || null
        }
      );
      toast.success('Shipping label generated successfully!');
      setShowLabelDialog(false);
      fetchOrders();
      
      // Reset form
      setLabelData({
        delivery_partner_id: 'none',
        warehouse_id: '',
        weight: '',
        dimensions: ''
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate shipping label');
    }
  };

  const openLabelDialog = (order) => {
    setSelectedOrder(order);
    // Set default warehouse if available
    const defaultWarehouse = warehouses.find(w => w.is_default);
    setLabelData({
      ...labelData,
      warehouse_id: defaultWarehouse?.id || ''
    });
    setShowLabelDialog(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Button variant="ghost" onClick={() => navigate('/seller')} className="mb-4" data-testid="back-btn">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        
        <h1 className="text-3xl font-bold mb-6">Orders</h1>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-500">No orders yet</p>
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
                    <div className="flex gap-2 items-center">
                      <Badge className={statusColors[order.status] || 'bg-gray-100'}>
                        {order.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.name} x {item.quantity}</span>
                        <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t pt-2 mb-4">
                    <div className="flex justify-between font-bold mb-2">
                      <span>Total Amount</span>
                      <span>₹{order.total_amount.toFixed(2)}</span>
                    </div>
                    {order.platform_fee_amount > 0 && (
                      <>
                        <div className="flex justify-between text-sm text-red-600">
                          <span>Platform Fee (2%)</span>
                          <span>- ₹{order.platform_fee_amount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold text-green-600 mt-1">
                          <span>Your Payout</span>
                          <span>₹{order.seller_payout.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Tracking & Barcode Info */}
                  {order.tracking_id && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Barcode className="w-5 h-5 text-blue-500" />
                        <span className="font-semibold text-blue-900">Shipping Details</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">Tracking ID:</span>
                          <p className="font-mono font-semibold">{order.tracking_id}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Barcode:</span>
                          <p className="font-mono font-semibold">{order.barcode}</p>
                        </div>
                        {order.delivery_partner_name && (
                          <div className="col-span-2">
                            <span className="text-gray-600">Delivery Partner:</span>
                            <p className="font-semibold">{order.delivery_partner_name}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="mb-4 text-sm text-gray-600">
                    <p className="font-semibold mb-1">Customer Details:</p>
                    <p>{order.shipping_address.name}</p>
                    <p>{order.shipping_address.address_line}</p>
                    <p>{order.shipping_address.city}, {order.shipping_address.state} - {order.shipping_address.pincode}</p>
                    <p>Phone: {order.shipping_address.phone}</p>
                  </div>

                  <div className="flex gap-2">
                    {!order.tracking_id ? (
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => openLabelDialog(order)}
                        data-testid={`generate-label-${order.id}`}
                      >
                        <Package className="w-4 h-4" />
                        Generate Shipping Label
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => toast.info('View shipping label: ' + order.tracking_id)}
                      >
                        <FileText className="w-4 h-4" />
                        View Label
                      </Button>
                    )}
                    
                    <Select
                      value={order.status}
                      onValueChange={(value) => updateOrderStatus(order.id, value)}
                    >
                      <SelectTrigger className="flex-1" data-testid={`status-select-${order.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="packed">Packed</SelectItem>
                        <SelectItem value="shipped">Shipped</SelectItem>
                        <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Shipping Label Dialog */}
      <Dialog open={showLabelDialog} onOpenChange={setShowLabelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Shipping Label</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {warehouses.length === 0 ? (
              <div className="text-center py-6">
                <Package className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600 mb-2">No warehouse found</p>
                <p className="text-sm text-gray-500 mb-4">
                  You need to create a warehouse first to generate shipping labels
                </p>
                <Button onClick={() => { setShowLabelDialog(false); navigate('/seller/warehouses'); }}>
                  Create Warehouse
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Warehouse *</label>
                  <Select
                    value={labelData.warehouse_id}
                    onValueChange={(value) => setLabelData({ ...labelData, warehouse_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose pickup location" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.name} - {warehouse.city}
                          {warehouse.is_default && ' (Default)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Delivery Partner (Optional)</label>
                  <Select
                    value={labelData.delivery_partner_id}
                    onValueChange={(value) => setLabelData({ ...labelData, delivery_partner_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose delivery partner or leave empty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Self-shipping)</SelectItem>
                      {deliveryPartners.map((partner) => (
                        <SelectItem key={partner.id} value={partner.id}>
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4" />
                            {partner.company_name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Package Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={labelData.weight}
                    onChange={(e) => setLabelData({ ...labelData, weight: e.target.value })}
                    placeholder="e.g., 2.5"
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Dimensions (LxWxH cm)</label>
                  <input
                    type="text"
                    value={labelData.dimensions}
                    onChange={(e) => setLabelData({ ...labelData, dimensions: e.target.value })}
                    placeholder="e.g., 30x20x10"
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div className="bg-blue-50 p-3 rounded-lg text-sm">
                  <p className="font-semibold mb-1">What happens next?</p>
                  <ul className="space-y-1 text-gray-600">
                    <li>• Unique tracking ID and barcode will be generated</li>
                    <li>• Order details will be sent to delivery partner</li>
                    <li>• Shipping label can be downloaded and printed</li>
                    <li>• Customer will receive tracking information</li>
                  </ul>
                </div>

                <Button onClick={generateShippingLabel} className="w-full">
                  Generate Label & Barcode
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
