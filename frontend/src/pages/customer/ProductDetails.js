import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Package, Heart, Star, Share2, MapPin, Truck, RotateCcw, Shield, ChevronRight, Plus, Minus, Zap, Store, MessageCircle, Check, X, ShoppingCart, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const defaultColors = [
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Green', hex: '#22C55E' },
  { name: 'Navy', hex: '#1E3A8A' }
];

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('black');
  const [quantity, setQuantity] = useState(1);
  const [pincode, setPincode] = useState('');
  const [deliveryInfo, setDeliveryInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [showImageZoom, setShowImageZoom] = useState(false);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [notifyMe, setNotifyMe] = useState(false);

  const colorImages = {
    black: product?.images?.[0] || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900',
    white: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=900',
    red: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=900',
    blue: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900',
  };

  useEffect(() => {
    fetchProduct();
    fetchReviews();
    fetchSimilar();
    addToRecentlyViewed();
  }, [id]);

  useEffect(() => {
    if (product) {
      const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
      setIsWishlisted(wishlist.some(item => item.id === product.id));
    }
  }, [product]);

  const fetchProduct = async () => {
    try {
      const response = await axios.get(`${API_URL}/products/${id}`);
      setProduct(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching product:', error);
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const [reviewsRes, summaryRes] = await Promise.all([
        axios.get(`${API_URL}/reviews/product/${id}`),
        axios.get(`${API_URL}/reviews/product/${id}/summary`)
      ]);
      setReviews(reviewsRes.data);
      setReviewSummary(summaryRes.data);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const fetchSimilar = async () => {
    try {
      const response = await axios.get(`${API_URL}/products/similar/${id}`);
      setSimilar(response.data);
    } catch (error) {
      console.error('Error fetching similar products:', error);
    }
  };

  const addToRecentlyViewed = () => {
    const recent = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
    const filtered = recent.filter(item => item !== id);
    filtered.unshift(id);
    localStorage.setItem('recentlyViewed', JSON.stringify(filtered.slice(0, 10)));
  };

  const toggleWishlist = () => {
    const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
    if (isWishlisted) {
      const filtered = wishlist.filter(item => item.id !== product.id);
      localStorage.setItem('wishlist', JSON.stringify(filtered));
      setIsWishlisted(false);
      toast.success('Removed from wishlist');
    } else {
      wishlist.push(product);
      localStorage.setItem('wishlist', JSON.stringify(wishlist));
      setIsWishlisted(true);
      toast.success('Added to wishlist');
    }
  };

  const checkDelivery = () => {
    if (pincode.length === 6) {
      // Mock delivery check
      setDeliveryInfo({
        available: true,
        estimatedDays: Math.floor(Math.random() * 5) + 3,
        cod: Math.random() > 0.3
      });
      toast.success('Delivery available!');
    } else {
      toast.error('Please enter valid 6-digit pincode');
    }
  };

  const addToCart = () => {
    if (!selectedSize) {
      toast.error('Please select a size');
      return;
    }

    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existingItem = cart.find(item => item.product_id === product.id && item.size === selectedSize);
    
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.push({
        product_id: product.id,
        seller_id: product.seller_id,
        name: product.name,
        price: product.price,
        image: colorImages[selectedColor],
        size: selectedSize,
        color: selectedColor,
        quantity: quantity
      });
    }
    
    localStorage.setItem('cart', JSON.stringify(cart));
    toast.success('Added to cart!');
  };

  const buyNow = () => {
    addToCart();
    navigate('/customer/cart');
  };

  const shareProduct = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: product.description,
          url: window.location.href
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Package className="w-16 h-16 text-gray-400 mb-4" />
        <p className="text-gray-500">Product not found</p>
        <Button onClick={() => navigate('/')} className="mt-4">Go Back</Button>
      </div>
    );
  }

  const discount = Math.round(((product.mrp - product.price) / product.mrp) * 100);
  const avgRating = reviewSummary?.average_rating || 4.2;
  const totalReviews = reviewSummary?.total_reviews || 0;
  const inStock = Math.random() > 0.2; // Mock stock check

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
          <span onClick={() => navigate('/')} className="cursor-pointer hover:text-blue-600">Home</span>
          <ChevronRight className="w-4 h-4" />
          <span onClick={() => navigate(`/customer/category/${product.category}`)} className="cursor-pointer hover:text-blue-600">{product.category}</span>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-900">{product.name}</span>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Images Section */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4 relative group">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={selectedColor}
                      src={colorImages[selectedColor]}
                      alt={product.name}
                      className="w-full h-full object-cover cursor-zoom-in"
                      onClick={() => setShowImageZoom(true)}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    />
                  </AnimatePresence>
                  <button
                    onClick={toggleWishlist}
                    className="absolute top-4 right-4 bg-white rounded-full p-2 shadow-lg hover:scale-110 transition-transform"
                  >
                    <Heart className={`w-6 h-6 ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
                  </button>
                </div>

                {/* Thumbnail Images */}
                {product.images && product.images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {product.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedImage(idx)}
                        className={`flex-shrink-0 w-20 h-20 rounded border-2 overflow-hidden ${
                          selectedImage === idx ? 'border-blue-500' : 'border-gray-200'
                        }`}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Button variant="outline" onClick={shareProduct} className="w-full">
                    <Share2 className="w-4 h-4 mr-2" /> Share
                  </Button>
                  <Dialog open={showSizeGuide} onOpenChange={setShowSizeGuide}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full">Size Guide</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Size Guide</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2">Size</th>
                              <th className="text-left py-2">Chest (inches)</th>
                              <th className="text-left py-2">Length (inches)</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b"><td className="py-2">S</td><td>36-38</td><td>27</td></tr>
                            <tr className="border-b"><td className="py-2">M</td><td>38-40</td><td>28</td></tr>
                            <tr className="border-b"><td className="py-2">L</td><td>40-42</td><td>29</td></tr>
                            <tr className="border-b"><td className="py-2">XL</td><td>42-44</td><td>30</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            {/* Seller Info */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Store className="w-8 h-8 text-blue-600" />
                  <div className="flex-1">
                    <p className="font-semibold">Sold by: Premium Seller</p>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span>4.5 Seller Rating</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">View Store</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Product Details Section */}
          <div className="space-y-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
              <p className="text-gray-600">{product.description}</p>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 bg-green-600 text-white px-3 py-1 rounded">
                <span className="font-semibold">{avgRating}</span>
                <Star className="w-4 h-4 fill-white" />
              </div>
              <span className="text-gray-600">{totalReviews.toLocaleString()} ratings & {reviews.length} reviews</span>
            </div>

            {/* Price */}
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
              <CardContent className="p-4">
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-4xl font-bold text-green-600">₹{product.price.toLocaleString()}</span>
                  {product.mrp > product.price && (
                    <>
                      <span className="text-xl text-gray-500 line-through">₹{product.mrp.toLocaleString()}</span>
                      <Badge className="bg-red-500 text-lg px-3">{discount}% off</Badge>
                    </>
                  )}
                </div>
                <p className="text-sm text-gray-600">+ ₹50 Secured Packaging Fee</p>
                <p className="text-green-600 font-semibold mt-2">You save ₹{(product.mrp - product.price).toLocaleString()}!</p>
              </CardContent>
            </Card>

            {/* Offers */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">Available Offers</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <p><span className="font-semibold">Bank Offer:</span> 10% Instant Discount on Bank Credit Cards</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <p><span className="font-semibold">Special Price:</span> Get extra 5% off (price inclusive of discount)</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <p><span className="font-semibold">Partner Offer:</span> Purchase now & get 1 surprise cashback coupon</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Color Selection */}
            <div>
              <h3 className="font-semibold mb-3">Select Color</h3>
              <div className="flex flex-wrap gap-3">
                {(product.colors && product.colors.length > 0 ? product.colors : defaultColors).map((color) => (
                  <button
                    key={color.name || color}
                    onClick={() => setSelectedColor(color.name || color)}
                    className={`w-12 h-12 rounded-full border-2 transition-all flex items-center justify-center ${
                      selectedColor === (color.name || color) ? 'border-blue-600 ring-2 ring-blue-200 scale-110' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color.hex || color }}
                    title={color.name || color}
                    data-testid={`color-${color.name || color}`}
                  >
                    {selectedColor === (color.name || color) && (
                      <Check className={`w-5 h-5 ${(color.hex || '').toLowerCase() === '#ffffff' || color.name?.toLowerCase() === 'white' ? 'text-black' : 'text-white'}`} />
                    )}
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-2">Selected: {selectedColor}</p>
            </div>

            {/* Size Selection */}
            <div>
              <h3 className="font-semibold mb-3">Select Size</h3>
              <div className="flex flex-wrap gap-2">
                {(product.sizes && product.sizes.length > 0 ? product.sizes : sizes).map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`px-6 py-3 border-2 rounded-lg font-semibold transition-all ${
                      selectedSize === size
                        ? 'border-blue-600 bg-blue-50 text-blue-600'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div>
              <h3 className="font-semibold mb-3">Quantity</h3>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-xl font-semibold w-12 text-center">{quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(Math.min(10, quantity + 1))}
                  disabled={quantity >= 10}
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-500">(Max 10 per order)</span>
              </div>
            </div>

            {/* Delivery Check */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Truck className="w-5 h-5" /> Delivery Options
                </h3>
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Enter Pincode"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    className="flex-1"
                  />
                  <Button onClick={checkDelivery} variant="outline">Check</Button>
                </div>
                {deliveryInfo && (
                  <div className="space-y-2 text-sm">
                    <p className="flex items-center gap-2 text-green-600">
                      <Check className="w-4 h-4" /> Delivery in {deliveryInfo.estimatedDays} days
                    </p>
                    {deliveryInfo.cod && (
                      <p className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" /> Cash on Delivery available
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stock Status */}
            {inStock ? (
              <div className="flex items-center gap-2 text-green-600">
                <Check className="w-5 h-5" />
                <span className="font-semibold">In Stock</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600">
                  <X className="w-5 h-5" />
                  <span className="font-semibold">Out of Stock</span>
                </div>
                <Button variant="outline" onClick={() => { setNotifyMe(true); toast.success('You will be notified when available'); }}>
                  <Bell className="w-4 h-4 mr-2" /> Notify Me
                </Button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 sticky bottom-0 bg-white p-4 -mx-4 border-t">
              <Button
                onClick={addToCart}
                variant="outline"
                className="flex-1 h-14 text-lg"
                disabled={!inStock || !selectedSize}
              >
                <ShoppingCart className="w-5 h-5 mr-2" /> Add to Cart
              </Button>
              <Button
                onClick={buyNow}
                className="flex-1 h-14 text-lg bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                disabled={!inStock || !selectedSize}
              >
                <Zap className="w-5 h-5 mr-2" /> Buy Now
              </Button>
            </div>
          </div>
        </div>

        {/* Additional Details Tabs */}
        <Card className="mt-8">
          <CardContent className="p-6">
            <Tabs defaultValue="details">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="details">Product Details</TabsTrigger>
                <TabsTrigger value="specifications">Specifications</TabsTrigger>
                <TabsTrigger value="reviews">Reviews ({totalReviews})</TabsTrigger>
                <TabsTrigger value="qa">Q&A</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Product Highlights</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span>Premium quality material</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span>Comfortable fit for all-day wear</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span>Easy to wash and maintain</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span>Available in multiple colors</span>
                    </li>
                  </ul>
                </div>

                <div className="grid md:grid-cols-3 gap-4 pt-4 border-t">
                  <div className="flex items-start gap-3">
                    <Truck className="w-6 h-6 text-blue-600" />
                    <div>
                      <p className="font-semibold">Free Delivery</p>
                      <p className="text-sm text-gray-600">On orders above ₹500</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <RotateCcw className="w-6 h-6 text-blue-600" />
                    <div>
                      <p className="font-semibold">7 Days Return</p>
                      <p className="text-sm text-gray-600">Easy returns & exchange</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Shield className="w-6 h-6 text-blue-600" />
                    <div>
                      <p className="font-semibold">Secure Payment</p>
                      <p className="text-sm text-gray-600">100% secure transactions</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="specifications">
                {Object.keys(product.specifications || {}).length > 0 ? (
                  <table className="w-full">
                    <tbody>
                      {Object.entries(product.specifications).map(([key, value], idx) => (
                        <tr key={key} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                          <td className="py-3 px-4 font-semibold w-1/3">{key}</td>
                          <td className="py-3 px-4">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-gray-500 text-center py-8">No specifications available</p>
                )}
              </TabsContent>

              <TabsContent value="reviews" className="space-y-4">
                {reviews.length > 0 ? (
                  reviews.map((review) => (
                    <Card key={review.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${
                                  i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="font-semibold">{review.customer_name || 'Anonymous'}</span>
                        </div>
                        {review.comment && <p className="text-gray-700 mb-2">{review.comment}</p>}
                        {review.images && review.images.length > 0 && (
                          <div className="flex gap-2">
                            {review.images.map((img, idx) => (
                              <img key={idx} src={img} alt="" className="w-20 h-20 rounded object-cover" />
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">No reviews yet. Be the first to review!</p>
                )}
              </TabsContent>

              <TabsContent value="qa">
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <MessageCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <p className="font-semibold mb-1">Have a question about this product?</p>
                      <Button variant="outline" size="sm">Ask a Question</Button>
                    </div>
                  </div>
                  <p className="text-gray-500 text-center py-8">No questions yet</p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Similar Products */}
        {similar.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4">Similar Products</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {similar.slice(0, 6).map((item) => (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 group"
                  onClick={() => navigate(`/customer/product/${item.id}`)}
                  data-testid={`similar-product-${item.id}`}
                >
                  <CardContent className="p-3">
                    <div className="aspect-square bg-gray-100 rounded mb-2 overflow-hidden relative">
                      <img 
                        src={item.images?.[0] || 'https://via.placeholder.com/200'} 
                        alt={item.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" 
                      />
                      {item.mrp > item.price && (
                        <span className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                          {Math.round(((item.mrp - item.price) / item.mrp) * 100)}% OFF
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm truncate group-hover:text-purple-600 transition-colors">{item.name}</h3>
                    <div className="flex items-baseline gap-2 mt-1">
                      <p className="text-lg font-bold text-green-600">₹{item.price}</p>
                      {item.mrp > item.price && (
                        <p className="text-sm text-gray-400 line-through">₹{item.mrp}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Image Zoom Modal */}
      <Dialog open={showImageZoom} onOpenChange={setShowImageZoom}>
        <DialogContent className="max-w-4xl">
          <img src={colorImages[selectedColor]} alt={product.name} className="w-full" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
