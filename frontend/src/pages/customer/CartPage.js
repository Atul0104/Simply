import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

// Helper function to create a unique key for cart items
const getCartItemKey = (item) => {
  return `${item.product_id}-${item.size || 'default'}-${item.color || 'default'}`;
};

export default function CartPage() {
  const [cart, setCart] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = () => {
    const savedCart = JSON.parse(localStorage.getItem('cart') || '[]');
    setCart(savedCart);
  };

  // Updated to handle items with different sizes/colors
  const updateQuantity = (productId, size, color, delta) => {
    const updatedCart = cart.map(item => {
      // Match by product_id AND size AND color
      if (item.product_id === productId && 
          (item.size || 'default') === (size || 'default') && 
          (item.color || 'default') === (color || 'default')) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    });
    setCart(updatedCart);
    localStorage.setItem('cart', JSON.stringify(updatedCart));
  };

  // Updated to remove only the specific item (by product_id + size + color)
  const removeItem = (productId, size, color) => {
    const updatedCart = cart.filter(item => {
      // Keep items that don't match ALL criteria (product_id AND size AND color)
      const matchesProduct = item.product_id === productId;
      const matchesSize = (item.size || 'default') === (size || 'default');
      const matchesColor = (item.color || 'default') === (color || 'default');
      return !(matchesProduct && matchesSize && matchesColor);
    });
    setCart(updatedCart);
    localStorage.setItem('cart', JSON.stringify(updatedCart));
    toast.success('Item removed from cart');
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-4" data-testid="back-btn">
          <ArrowLeft className="w-4 h-4 mr-2" /> Continue Shopping
        </Button>
        
        <h1 className="text-3xl font-bold mb-6">Shopping Cart</h1>
        
        {cart.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <ShoppingBag className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">Your cart is empty</p>
              <Button onClick={() => navigate('/')}>Start Shopping</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {cart.map((item) => (
                <Card key={getCartItemKey(item)} data-testid={`cart-item-${getCartItemKey(item)}`}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-24 h-24 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">No image</div>
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">{item.name}</h3>
                        {/* Display size and color if available */}
                        {(item.size || item.color) && (
                          <p className="text-sm text-gray-500 mb-1">
                            {item.size && <span>Size: {item.size}</span>}
                            {item.size && item.color && <span> | </span>}
                            {item.color && <span>Color: {item.color}</span>}
                          </p>
                        )}
                        <p className="text-lg font-bold mb-2">₹{item.price}</p>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(item.product_id, item.size, item.color, -1)}
                            data-testid={`decrease-qty-${getCartItemKey(item)}`}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-8 text-center font-semibold">{item.quantity}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(item.product_id, item.size, item.color, 1)}
                            data-testid={`increase-qty-${getCartItemKey(item)}`}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.product_id, item.size, item.color)}
                        data-testid={`remove-item-${getCartItemKey(item)}`}
                      >
                        <Trash2 className="w-5 h-5 text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <div>
              <Card className="sticky top-4">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg mb-4">Order Summary</h3>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span>Subtotal ({totalItems} items)</span>
                      <span>₹{total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Shipping</span>
                      <span className="text-green-600">FREE</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>₹{total.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <Button
                    className="w-full"
                    onClick={() => navigate('/customer/checkout')}
                    data-testid="checkout-btn"
                  >
                    Proceed to Checkout
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
