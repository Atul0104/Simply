import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, CheckCircle, MapPin, Plus, Home, Briefcase, Truck, CreditCard, Wallet, Tag, Check, X, AlertCircle, Smartphone, Building } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function CheckoutPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [step, setStep] = useState(1); // 1: Address, 2: Payment
  
  // Platform settings (GST)
  const [platformSettings, setPlatformSettings] = useState({
    gst_percentage: 18.0,
    platform_fee_percentage: 2.0
  });
  
  // Address state
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [showNewAddressDialog, setShowNewAddressDialog] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({
    name: '',
    phone: '',
    pincode: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    landmark: '',
    address_type: 'home',
    is_default: false
  });
  const [pincodeLoading, setPincodeLoading] = useState(false);
  
  // Payment state
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [razorpayAvailable, setRazorpayAvailable] = useState(false);
  
  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(null);

  const cart = JSON.parse(localStorage.getItem('cart') || '[]');
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shipping = subtotal > 500 ? 0 : 50;
  
  // GST Calculation
  const gstAmount = (subtotal * platformSettings.gst_percentage) / 100;
  const total = subtotal + shipping + gstAmount - couponDiscount;

  useEffect(() => {
    if (user) {
      fetchSavedAddresses();
      fetchPlatformSettings();
      checkRazorpayAvailability();
    }
  }, [user]);

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const fetchPlatformSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/platform-settings`);
      setPlatformSettings(response.data);
    } catch (error) {
      console.error('Error fetching platform settings:', error);
    }
  };

  const checkRazorpayAvailability = async () => {
    try {
      // Check if Razorpay is configured by trying to create a test order
      // This is a simple check - if the endpoint fails with 503, Razorpay is not configured
      setRazorpayAvailable(true); // Optimistic - will be set to false if payment fails
    } catch (error) {
      setRazorpayAvailable(false);
    }
  };

  const fetchSavedAddresses = async () => {
    setAddressesLoading(true);
    try {
      // Get token from localStorage as fallback
      const authToken = token || localStorage.getItem('token');
      if (!authToken) {
        console.error('No auth token available');
        setAddressesLoading(false);
        return;
      }
      
      const response = await axios.get(`${API_URL}/addresses`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setSavedAddresses(response.data || []);
      // Select default address
      const defaultAddr = response.data.find(a => a.is_default);
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.id);
      } else if (response.data.length > 0) {
        setSelectedAddressId(response.data[0].id);
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
      toast.error('Failed to load saved addresses');
    } finally {
      setAddressesLoading(false);
    }
  };

  const handlePincodeChange = async (pincode) => {
    setAddressForm({ ...addressForm, pincode });
    if (pincode.length === 6) {
      setPincodeLoading(true);
      try {
        const response = await axios.get(`${API_URL}/pincode/${pincode}`);
        setAddressForm(prev => ({
          ...prev,
          city: response.data.city,
          state: response.data.state
        }));
        toast.success('Address details fetched!');
      } catch (error) {
        toast.error('Could not fetch address details');
      }
      setPincodeLoading(false);
    }
  };

  const handleAddNewAddress = async () => {
    if (!addressForm.name || !addressForm.phone || !addressForm.pincode || !addressForm.address_line1 || !addressForm.city || !addressForm.state) {
      toast.error('Please fill all required fields');
      return;
    }

    setSavingAddress(true);
    try {
      // Get token from localStorage as fallback
      const authToken = token || localStorage.getItem('token');
      if (!authToken) {
        toast.error('Please login again to add address');
        setSavingAddress(false);
        return;
      }
      
      const response = await axios.post(`${API_URL}/addresses`, addressForm, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      toast.success('Address added successfully');
      setShowNewAddressDialog(false);
      setAddressForm({
        name: '',
        phone: '',
        pincode: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        landmark: '',
        address_type: 'home',
        is_default: false
      });
      await fetchSavedAddresses();
      setSelectedAddressId(response.data.id);
    } catch (error) {
      console.error('Error adding address:', error);
      toast.error(error.response?.data?.detail || 'Failed to add address');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/coupons/validate/${couponCode}`, {
        params: { order_amount: subtotal }
      });
      setCouponDiscount(response.data.discount);
      setCouponApplied(response.data);
      toast.success(`Coupon applied! You saved ₹${response.data.discount}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid coupon code');
    }
  };

  const removeCoupon = () => {
    setCouponCode('');
    setCouponDiscount(0);
    setCouponApplied(null);
    toast.success('Coupon removed');
  };

  const getSelectedAddress = () => {
    return savedAddresses.find(a => a.id === selectedAddressId);
  };

  const createOrder = async () => {
    const selectedAddress = getSelectedAddress();
    
    const orderData = {
      items: cart,
      total_amount: total,
      shipping_address: {
        name: selectedAddress.name,
        phone: selectedAddress.phone,
        address_line: `${selectedAddress.address_line1}${selectedAddress.address_line2 ? ', ' + selectedAddress.address_line2 : ''}`,
        city: selectedAddress.city,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
        landmark: selectedAddress.landmark
      }
    };

    const response = await axios.post(`${API_URL}/orders`, orderData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  };

  const handleRazorpayPayment = async () => {
    const selectedAddress = getSelectedAddress();
    if (!selectedAddress) {
      toast.error('Please select a delivery address');
      return;
    }

    setPaymentProcessing(true);

    try {
      // First create the order in our system
      const order = await createOrder();
      
      // Then create Razorpay payment order
      const paymentOrderResponse = await axios.post(
        `${API_URL}/payments/create-order`,
        {
          amount: total,
          order_id: order.id,
          notes: {
            order_id: order.id,
            customer_name: selectedAddress.name
          }
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { razorpay_order_id, key_id, amount } = paymentOrderResponse.data;

      // Open Razorpay checkout
      const options = {
        key: key_id,
        amount: amount,
        currency: "INR",
        name: "Black Money",
        description: `Order #${order.id}`,
        order_id: razorpay_order_id,
        handler: async function (response) {
          try {
            // Verify payment on server
            await axios.post(
              `${API_URL}/payments/verify`,
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                internal_order_id: order.id
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setOrderId(order.id);
            setOrderPlaced(true);
            localStorage.setItem('cart', '[]');
            toast.success('Payment successful! Order placed.');
          } catch (error) {
            toast.error('Payment verification failed. Please contact support.');
          }
        },
        prefill: {
          name: selectedAddress.name,
          email: user?.email || '',
          contact: selectedAddress.phone
        },
        theme: {
          color: "#9333EA" // Purple theme
        },
        modal: {
          ondismiss: function() {
            setPaymentProcessing(false);
            toast.error('Payment cancelled');
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', function (response) {
        toast.error(`Payment failed: ${response.error.description}`);
        setPaymentProcessing(false);
      });
      razorpay.open();
    } catch (error) {
      console.error('Payment error:', error);
      if (error.response?.status === 503) {
        toast.error('Online payment is not available. Please use Cash on Delivery.');
        setRazorpayAvailable(false);
        setPaymentMethod('cod');
      } else {
        toast.error(error.response?.data?.detail || 'Failed to initiate payment');
      }
      setPaymentProcessing(false);
    }
  };

  const handlePlaceOrder = async () => {
    const selectedAddress = getSelectedAddress();
    if (!selectedAddress) {
      toast.error('Please select a delivery address');
      return;
    }

    // If online payment method selected, use Razorpay
    if (paymentMethod !== 'cod') {
      handleRazorpayPayment();
      return;
    }

    // Cash on Delivery flow
    setLoading(true);

    try {
      const order = await createOrder();
      setOrderId(order.id);
      setOrderPlaced(true);
      localStorage.setItem('cart', '[]');
      toast.success('Order placed successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p className="mb-4">Please login to proceed with checkout</p>
            <Button onClick={() => navigate('/auth')}>Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (cart.length === 0 && !orderPlaced) {
    navigate('/customer/cart');
    return null;
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="max-w-md w-full">
            <CardContent className="p-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
              >
                <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
              </motion.div>
              <h2 className="text-2xl font-bold mb-2">Order Placed Successfully!</h2>
              <p className="text-gray-600 mb-1">Order ID: <span className="font-mono font-semibold">{orderId}</span></p>
              <p className="text-sm text-gray-500 mb-6">We'll send you updates via email and SMS</p>
              <div className="flex gap-3">
                <Button onClick={() => navigate('/customer/orders')} className="flex-1" data-testid="view-orders-btn">
                  View Orders
                </Button>
                <Button onClick={() => navigate('/')} variant="outline" className="flex-1">
                  Continue Shopping
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Button variant="ghost" onClick={() => navigate('/customer/cart')} className="mb-4" data-testid="back-btn">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Cart
        </Button>
        
        <h1 className="text-3xl font-bold mb-6">Checkout</h1>
        
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
              <MapPin className="w-4 h-4" />
            </div>
            <span className="font-medium">Address</span>
          </div>
          <div className={`w-16 h-1 mx-2 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
              <CreditCard className="w-4 h-4" />
            </div>
            <span className="font-medium">Payment</span>
          </div>
        </div>
        
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="address"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="w-5 h-5" /> Select Delivery Address
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {addressesLoading ? (
                        <div className="text-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                          <p className="text-gray-500">Loading addresses...</p>
                        </div>
                      ) : savedAddresses.length === 0 ? (
                        <div className="text-center py-8">
                          <MapPin className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                          <p className="text-gray-500 mb-4">No saved addresses</p>
                          <Button onClick={() => setShowNewAddressDialog(true)}>
                            <Plus className="w-4 h-4 mr-2" /> Add New Address
                          </Button>
                        </div>
                      ) : (
                        <>
                          <RadioGroup value={selectedAddressId} onValueChange={setSelectedAddressId}>
                            {savedAddresses.map((address) => (
                              <div key={address.id} className="flex items-start gap-3">
                                <RadioGroupItem value={address.id} id={address.id} className="mt-1" />
                                <label htmlFor={address.id} className="flex-1 cursor-pointer">
                                  <Card className={`${selectedAddressId === address.id ? 'border-blue-500 border-2' : ''}`}>
                                    <CardContent className="p-4">
                                      <div className="flex items-center gap-2 mb-2">
                                        {address.address_type === 'home' ? (
                                          <Home className="w-4 h-4 text-blue-500" />
                                        ) : (
                                          <Briefcase className="w-4 h-4 text-purple-500" />
                                        )}
                                        <span className="font-semibold capitalize">{address.address_type}</span>
                                        {address.is_default && (
                                          <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded">Default</span>
                                        )}
                                      </div>
                                      <p className="font-medium">{address.name}</p>
                                      <p className="text-gray-600 text-sm">
                                        {address.address_line1}
                                        {address.address_line2 && `, ${address.address_line2}`}
                                      </p>
                                      <p className="text-gray-600 text-sm">
                                        {address.city}, {address.state} - {address.pincode}
                                      </p>
                                      <p className="text-gray-600 text-sm">Phone: {address.phone}</p>
                                    </CardContent>
                                  </Card>
                                </label>
                              </div>
                            ))}
                          </RadioGroup>
                          
                          <Button variant="outline" onClick={() => setShowNewAddressDialog(true)} className="w-full">
                            <Plus className="w-4 h-4 mr-2" /> Add New Address
                          </Button>
                        </>
                      )}
                      
                      {selectedAddressId && (
                        <Button onClick={() => setStep(2)} className="w-full mt-4">
                          Continue to Payment
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
              
              {step === 2 && (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  {/* Selected Address Summary */}
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Delivering to:</p>
                          <p className="font-medium">{getSelectedAddress()?.name}</p>
                          <p className="text-sm text-gray-600">
                            {getSelectedAddress()?.address_line1}, {getSelectedAddress()?.city} - {getSelectedAddress()?.pincode}
                          </p>
                        </div>
                        <Button variant="link" size="sm" onClick={() => setStep(1)}>Change</Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Payment Method */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5" /> Payment Method
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                        <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
                          <RadioGroupItem value="cod" id="cod" />
                          <label htmlFor="cod" className="flex-1 cursor-pointer flex items-center gap-3">
                            <Wallet className="w-5 h-5 text-green-600" />
                            <div>
                              <p className="font-medium">Cash on Delivery</p>
                              <p className="text-sm text-gray-500">Pay when you receive</p>
                            </div>
                          </label>
                        </div>
                        
                        <div className={`flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 ${!razorpayAvailable ? 'opacity-50' : ''}`}>
                          <RadioGroupItem value="card" id="card" disabled={!razorpayAvailable} />
                          <label htmlFor="card" className="flex-1 cursor-pointer flex items-center gap-3">
                            <CreditCard className="w-5 h-5 text-blue-600" />
                            <div>
                              <p className="font-medium">Credit/Debit Card</p>
                              <p className="text-sm text-gray-500">
                                {razorpayAvailable ? 'Visa, Mastercard, RuPay' : 'Not available'}
                              </p>
                            </div>
                          </label>
                        </div>
                        
                        <div className={`flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 ${!razorpayAvailable ? 'opacity-50' : ''}`}>
                          <RadioGroupItem value="upi" id="upi" disabled={!razorpayAvailable} />
                          <label htmlFor="upi" className="flex-1 cursor-pointer flex items-center gap-3">
                            <Smartphone className="w-5 h-5 text-purple-600" />
                            <div>
                              <p className="font-medium">UPI</p>
                              <p className="text-sm text-gray-500">
                                {razorpayAvailable ? 'GPay, PhonePe, Paytm' : 'Not available'}
                              </p>
                            </div>
                          </label>
                        </div>
                        
                        <div className={`flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 ${!razorpayAvailable ? 'opacity-50' : ''}`}>
                          <RadioGroupItem value="netbanking" id="netbanking" disabled={!razorpayAvailable} />
                          <label htmlFor="netbanking" className="flex-1 cursor-pointer flex items-center gap-3">
                            <Building className="w-5 h-5 text-orange-600" />
                            <div>
                              <p className="font-medium">Net Banking</p>
                              <p className="text-sm text-gray-500">
                                {razorpayAvailable ? 'All major banks' : 'Not available'}
                              </p>
                            </div>
                          </label>
                        </div>
                      </RadioGroup>
                      
                      {!razorpayAvailable && (
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-yellow-800">
                            <p className="font-medium">Online payment temporarily unavailable</p>
                            <p>Please use Cash on Delivery to complete your order.</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Order Summary */}
          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {cart.map((item) => (
                    <div key={`${item.product_id}-${item.size}`} className="flex justify-between text-sm">
                      <span className="truncate flex-1 mr-2">{item.name} x {item.quantity}</span>
                      <span className="font-medium">₹{(item.price * item.quantity).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
                
                {/* Coupon */}
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-4 h-4 text-orange-500" />
                    <span className="font-medium">Apply Coupon</span>
                  </div>
                  {couponApplied ? (
                    <div className="flex items-center justify-between bg-green-50 p-2 rounded">
                      <div>
                        <p className="font-medium text-green-700">{couponApplied.code}</p>
                        <p className="text-sm text-green-600">-₹{couponDiscount.toFixed(0)} off</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={removeCoupon}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter coupon code"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        className="flex-1"
                      />
                      <Button variant="outline" onClick={handleApplyCoupon}>Apply</Button>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2 border-t pt-4">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>₹{subtotal.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span className={shipping === 0 ? 'text-green-600' : ''}>
                      {shipping === 0 ? 'FREE' : `₹${shipping}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>GST ({platformSettings.gst_percentage}%)</span>
                    <span>₹{gstAmount.toFixed(0)}</span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Coupon Discount</span>
                      <span>-₹{couponDiscount.toFixed(0)}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>₹{total.toFixed(0)}</span>
                  </div>
                </div>
                
                {step === 2 && (
                  <Button
                    onClick={handlePlaceOrder}
                    className="w-full h-12 text-lg"
                    disabled={loading || paymentProcessing || !selectedAddressId}
                    data-testid="place-order-btn"
                  >
                    {loading || paymentProcessing ? (
                      paymentMethod !== 'cod' ? 'Processing Payment...' : 'Placing Order...'
                    ) : (
                      paymentMethod !== 'cod' ? `Pay Now • ₹${total.toFixed(0)}` : `Place Order • ₹${total.toFixed(0)}`
                    )}
                  </Button>
                )}
                
                {subtotal < 500 && (
                  <p className="text-sm text-center text-gray-500">
                    Add ₹{(500 - subtotal).toFixed(0)} more for free shipping
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Add New Address Dialog */}
      <Dialog open={showNewAddressDialog} onOpenChange={setShowNewAddressDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Address</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Full Name *</Label>
                <Input
                  value={addressForm.name}
                  onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })}
                  placeholder="Enter name"
                />
              </div>
              <div>
                <Label>Phone Number *</Label>
                <Input
                  value={addressForm.phone}
                  onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                  placeholder="10-digit number"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pincode *</Label>
                <Input
                  value={addressForm.pincode}
                  onChange={(e) => handlePincodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit pincode"
                  maxLength={6}
                />
                {pincodeLoading && <p className="text-xs text-blue-500 mt-1">Fetching location...</p>}
              </div>
              <div>
                <Label>Address Type</Label>
                <Select value={addressForm.address_type} onValueChange={(v) => setAddressForm({ ...addressForm, address_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home">Home</SelectItem>
                    <SelectItem value="work">Work</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Address Line 1 *</Label>
              <Input
                value={addressForm.address_line1}
                onChange={(e) => setAddressForm({ ...addressForm, address_line1: e.target.value })}
                placeholder="House No., Building, Street"
              />
            </div>
            <div>
              <Label>Address Line 2</Label>
              <Input
                value={addressForm.address_line2}
                onChange={(e) => setAddressForm({ ...addressForm, address_line2: e.target.value })}
                placeholder="Area, Colony"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>City *</Label>
                <Input
                  value={addressForm.city}
                  onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                  placeholder="City"
                />
              </div>
              <div>
                <Label>State *</Label>
                <Input
                  value={addressForm.state}
                  onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                  placeholder="State"
                />
              </div>
            </div>
            <div>
              <Label>Landmark (Optional)</Label>
              <Input
                value={addressForm.landmark}
                onChange={(e) => setAddressForm({ ...addressForm, landmark: e.target.value })}
                placeholder="Nearby landmark"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_default_new"
                checked={addressForm.is_default}
                onChange={(e) => setAddressForm({ ...addressForm, is_default: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="is_default_new">Set as default address</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewAddressDialog(false)} disabled={savingAddress}>Cancel</Button>
            <Button onClick={handleAddNewAddress} disabled={savingAddress}>
              {savingAddress ? 'Adding...' : 'Add Address'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
