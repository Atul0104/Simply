import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Truck, CheckCircle, MapPin, Calendar, Barcode, Phone, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const STATUS_STEPS = [
  { key: 'pending', label: 'Order Placed', icon: Package },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { key: 'packed', label: 'Packed', icon: Package },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle },
];

export default function OrderTracking() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrackingData();
  }, [orderId]);

  const fetchTrackingData = async () => {
    try {
      const response = await axios.get(`${API_URL}/orders/${orderId}/tracking`);
      setTrackingData(response.data);
    } catch (error) {
      toast.error('Failed to fetch tracking information');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentStepIndex = () => {
    if (!trackingData?.order) return 0;
    return STATUS_STEPS.findIndex(step => step.key === trackingData.order.status);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!trackingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Order not found</p>
            <Button onClick={() => navigate('/')} className="mt-4">Go to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { order, label, delivery_history } = trackingData;
  const currentStepIndex = getCurrentStepIndex();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/customer/orders')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Orders
        </Button>

        {/* Order Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Track Your Order</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Order ID: {order.id}</p>
              </div>
              <Badge className={
                order.status === 'delivered' ? 'bg-green-500' :
                order.status === 'cancelled' ? 'bg-red-500' :
                'bg-blue-500'
              }>
                {order.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Order Date</p>
                  <p className="font-medium">{format(new Date(order.created_at), 'PP')}</p>
                </div>
              </div>
              {label && (
                <>
                  <div className="flex items-center gap-2">
                    <Barcode className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Tracking ID</p>
                      <p className="font-mono font-medium">{label.tracking_id}</p>
                    </div>
                  </div>
                  {label.delivery_partner_name && (
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Delivery Partner</p>
                        <p className="font-medium">{label.delivery_partner_name}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Progress Tracker */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="relative">
              {/* Progress Line */}
              <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200">
                <div
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${(currentStepIndex / (STATUS_STEPS.length - 1)) * 100}%` }}
                />
              </div>

              {/* Steps */}
              <div className="relative flex justify-between">
                {STATUS_STEPS.map((step, index) => {
                  const Icon = step.icon;
                  const isCompleted = index <= currentStepIndex;
                  const isCurrent = index === currentStepIndex;

                  return (
                    <div key={step.key} className="flex flex-col items-center">
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center border-2 bg-white
                        ${isCompleted ? 'border-green-500 text-green-500' : 'border-gray-300 text-gray-300'}
                        ${isCurrent ? 'ring-4 ring-green-100' : ''}
                      `}>
                        {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                      </div>
                      <p className={`
                        text-xs mt-2 text-center max-w-[80px]
                        ${isCompleted ? 'text-green-600 font-semibold' : 'text-gray-500'}
                      `}>
                        {step.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Delivery History */}
          {delivery_history && delivery_history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Delivery Updates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {delivery_history.map((update, index) => (
                    <div key={update.id || index} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        {index < delivery_history.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-200 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="font-medium capitalize">{update.status.replace('_', ' ')}</p>
                        {update.location && (
                          <p className="text-sm text-gray-500">{update.location}</p>
                        )}
                        {update.remarks && (
                          <p className="text-sm text-gray-600 mt-1">{update.remarks}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {format(new Date(update.timestamp), 'PPp')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Delivery Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Delivery Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="font-semibold">{order.shipping_address.name}</p>
                <p className="text-sm text-gray-600">{order.shipping_address.address_line}</p>
                <p className="text-sm text-gray-600">
                  {order.shipping_address.city}, {order.shipping_address.state} - {order.shipping_address.pincode}
                </p>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <p className="text-sm">{order.shipping_address.phone}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {order.items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-semibold">₹{(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="font-bold text-lg">Total Amount</span>
                  <span className="font-bold text-lg">₹{order.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Help Section */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-2">Need Help?</h3>
            <p className="text-sm text-gray-600 mb-4">
              If you have any questions about your order or delivery, please contact our customer support.
            </p>
            <Button variant="outline" onClick={() => navigate('/customer/support')}>
              Contact Support
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
