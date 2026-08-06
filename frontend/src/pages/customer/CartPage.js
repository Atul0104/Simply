import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import PerfumeRecommendations from '@/components/PerfumeRecommendations';

// Helper function to create a unique key for cart items
const getCartItemKey = (item) => {
  return `${item.product_id}-${item.variant_id || item.size || 'default'}`;
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

  const updateQuantity = (productId, variantId, size, delta) => {
    const updatedCart = cart.map(item => {
      if (item.product_id === productId && 
          (item.variant_id || null) === (variantId || null) &&
          (item.size || 'default') === (size || 'default')) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    });
    setCart(updatedCart);
    localStorage.setItem('cart', JSON.stringify(updatedCart));
  };

  const removeItem = (productId, variantId, size) => {
    const updatedCart = cart.filter(item => {
      const matchesProduct = item.product_id === productId;
      const matchesVariant = (item.variant_id || null) === (variantId || null);
      const matchesSize = (item.size || 'default') === (size || 'default');
      return !(matchesProduct && matchesVariant && matchesSize);
    });
    setCart(updatedCart);
    localStorage.setItem('cart', JSON.stringify(updatedCart));
    toast.success('Item removed from cart');
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-4" data-testid="back-btn">
          <ArrowLeft className="w-4 h-4 mr-2" /> Continue Shopping
        </Button>
        
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Shopping Cart</h1>
        
        {cart.length === 0 ? (
          <div>
            <Card>
              <CardContent className="p-12 text-center">
                <ShoppingBag className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 mb-4">Your cart is empty</p>
                <Button onClick={() => navigate('/')}>Start Shopping</Button>
              </CardContent>
            </Card>
            <PerfumeRecommendations title="Trending perfumes to start your cart" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {cart.map((item) => (
                <Card key={getCartItemKey(item)} data-testid={`cart-item-${getCartItemKey(item)}`}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex gap-3 sm:gap-4">
                      <div className="w-20 h-24 sm:w-24 sm:h-24 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-contain p-1" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">No image</div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold mb-1 text-sm sm:text-base line-clamp-2">{item.name}</h3>
                        {item.size && (
                          <p className="text-sm text-gray-500 mb-1">
                            <span>Bottle: {item.size}</span>
                          </p>
                        )}
                        <p className="text-lg font-bold mb-2">₹{item.price}</p>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(item.product_id, item.variant_id, item.size, -1)}
                            data-testid={`decrease-qty-${getCartItemKey(item)}`}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-8 text-center font-semibold">{item.quantity}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(item.product_id, item.variant_id, item.size, 1)}
                            data-testid={`increase-qty-${getCartItemKey(item)}`}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.product_id, item.variant_id, item.size)}
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
