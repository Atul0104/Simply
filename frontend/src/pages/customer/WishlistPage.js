import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Heart, ShoppingCart, Trash2, Package } from 'lucide-react';
import { toast } from 'sonner';

export default function WishlistPage() {
  const [wishlist, setWishlist] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadWishlist();
  }, []);

  const loadWishlist = () => {
    const saved = JSON.parse(localStorage.getItem('wishlist') || '[]');
    setWishlist(saved);
  };

  const removeItem = (productId) => {
    const updated = wishlist.filter(item => item.id !== productId);
    setWishlist(updated);
    localStorage.setItem('wishlist', JSON.stringify(updated));
    toast.success('Removed from wishlist');
  };

  const moveToCart = (product) => {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const exists = cart.find(item => item.product_id === product.id);
    
    if (!exists) {
      cart.push({
        product_id: product.id,
        seller_id: product.seller_id,
        name: product.name,
        price: product.price,
        image: product.images?.[0] || '',
        quantity: 1
      });
      localStorage.setItem('cart', JSON.stringify(cart));
      toast.success('Moved to cart!');
    } else {
      toast.info('Already in cart');
    }
    
    removeItem(product.id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        
        <div className="flex items-center gap-3 mb-6">
          <Heart className="w-8 h-8 text-red-500 fill-red-500" />
          <h1 className="text-3xl font-bold">My Wishlist</h1>
          <span className="text-gray-500">({wishlist.length} items)</span>
        </div>

        {wishlist.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Heart className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">Your wishlist is empty</p>
              <Button onClick={() => navigate('/')}>Start Shopping</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {wishlist.map((product) => {
              const discount = Math.round(((product.mrp - product.price) / product.mrp) * 100);
              
              return (
                <Card key={product.id} className="group hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div
                      className="aspect-square bg-gray-100 rounded mb-3 cursor-pointer relative overflow-hidden"
                      onClick={() => navigate(`/customer/product/${product.id}`)}
                    >
                      {product.images?.[0] ? (
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-12 h-12 text-gray-400" />
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeItem(product.id); }}
                        className="absolute top-2 right-2 bg-white rounded-full p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                    
                    <h3 className="font-semibold truncate mb-1">{product.name}</h3>
                    <p className="text-sm text-gray-500 truncate mb-2">{product.category}</p>
                    
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-bold text-lg">₹{product.price}</span>
                      {product.mrp > product.price && (
                        <>
                          <span className="text-sm text-gray-400 line-through">₹{product.mrp}</span>
                          <span className="text-xs text-green-600 font-semibold">{discount}% off</span>
                        </>
                      )}
                    </div>
                    
                    <Button
                      onClick={() => moveToCart(product)}
                      className="w-full"
                      size="sm"
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" /> Move to Cart
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
