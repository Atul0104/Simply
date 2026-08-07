import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Package, Heart, Star, Share2, Truck, RotateCcw, Shield, ChevronLeft, ChevronRight, Plus, Minus, Zap, MessageCircle, Check, X, ShoppingCart, Bell, Sparkles, Droplets, Clock3, Wind, Award, Leaf, Play } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import BottleLoader from '@/components/BottleLoader';
import Seo from '@/components/Seo';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [pincode, setPincode] = useState('');
  const [deliveryInfo, setDeliveryInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [showImageZoom, setShowImageZoom] = useState(false);
  const [notifyMe, setNotifyMe] = useState(false);

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const response = await axios.get(`${API_URL}/products/${id}`);
        const loadedProduct = response.data;
        setProduct(loadedProduct);
        const firstVariant = loadedProduct.variants?.find((variant) => variant.is_active !== false);
        setSelectedSize(firstVariant
          ? (firstVariant.label || (firstVariant.size_ml ? `${firstVariant.size_ml} ml` : firstVariant.id))
          : (loadedProduct.sizes?.[0] || ''));
        addToRecentlyViewed(loadedProduct.id);
        await Promise.all([fetchReviews(loadedProduct.id), fetchSimilar(loadedProduct.id)]);
      } catch (error) {
        console.error('Error fetching product:', error);
      } finally {
        setLoading(false);
      }
    };
    loadProduct();
  }, [id]);

  useEffect(() => {
    if (product) {
      const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
      setIsWishlisted(wishlist.some(item => item.id === product.id));
    }
  }, [product]);

  const fetchReviews = async (productId) => {
    try {
      const [reviewsRes, summaryRes] = await Promise.all([
        axios.get(`${API_URL}/reviews/product/${productId}`),
        axios.get(`${API_URL}/reviews/product/${productId}/summary`)
      ]);
      setReviews(reviewsRes.data);
      setReviewSummary(summaryRes.data);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const fetchSimilar = async (productId) => {
    try {
      const response = await axios.get(`${API_URL}/products/similar/${productId}`);
      setSimilar(response.data);
    } catch (error) {
      console.error('Error fetching similar products:', error);
    }
  };

  const addToRecentlyViewed = (productId) => {
    const recent = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
    const filtered = recent.filter(item => item !== productId);
    filtered.unshift(productId);
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

  const checkDelivery = async () => {
    if (!/^\d{6}$/.test(pincode)) {
      toast.error('Please enter valid 6-digit pincode');
      return;
    }
    try {
      const response = await axios.get(`${API_URL}/pincode/${pincode}`);
      setDeliveryInfo({
        available: response.data.delivery_available,
        estimatedDays: response.data.estimated_delivery_days,
        cod: response.data.cod_available,
        deliveryCharge: response.data.delivery_charge,
      });
      if (response.data.delivery_available) toast.success('Delivery is available');
      else toast.error('Delivery is not currently available for this pincode');
    } catch (error) {
      setDeliveryInfo(null);
      toast.error(error.response?.data?.detail || 'Unable to check delivery');
    }
  };

  const addToCart = () => {
    if (product?.is_coming_soon) { toast.info('This fragrance is coming soon'); return false; }
    if (!selectedSize) {
      toast.error('Please select a size');
      return;
    }

    const selectedVariant = product.variants?.find((variant) =>
      variant.is_active !== false && (variant.label === selectedSize || `${variant.size_ml} ml` === selectedSize || variant.id === selectedSize)
    );
    if (product.variants?.length && !selectedVariant) {
      toast.error('Please select an available bottle size');
      return false;
    }
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existingItem = cart.find(item => item.product_id === product.id && item.variant_id === selectedVariant?.id && item.size === selectedSize);
    
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.push({
        product_id: product.id,
        seller_id: product.seller_id,
        name: product.name,
        price: selectedVariant?.price ?? product.price,
        mrp: selectedVariant?.mrp ?? product.mrp,
        variant_id: selectedVariant?.id,
        variant_sku: selectedVariant?.sku,
        image: selectedVariant?.image || product.images?.[0],
        size: selectedSize,
        quantity: quantity
      });
    }
    
    localStorage.setItem('cart', JSON.stringify(cart));
    toast.success('Added to cart!');
    return true;
  };

  const buyNow = () => {
    if (addToCart()) navigate('/customer/cart');
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
    return <div className="min-h-screen perfurm-page"><BottleLoader label="Unveiling your fragrance" /></div>;
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

  const activeVariants = product.variants?.filter((variant) => variant.is_active !== false) || [];
  const selectedVariant = activeVariants.find((variant) =>
    variant.label === selectedSize || `${variant.size_ml} ml` === selectedSize || variant.id === selectedSize
  );
  const displayPrice = Number(selectedVariant?.price ?? product.price);
  const displayMrp = Number(selectedVariant?.mrp ?? product.mrp);
  const discount = displayMrp > 0 ? Math.round(((displayMrp - displayPrice) / displayMrp) * 100) : 0;
  const avgRating = reviewSummary?.average_rating || 4.2;
  const totalReviews = reviewSummary?.total_reviews || 0;
  const inStock = selectedVariant ? Number(selectedVariant.stock_quantity ?? 0) > 0 : Number(product.stock_quantity ?? 1) > 0;
  const gallery = [
    ...((selectedVariant?.image && !product.images?.includes(selectedVariant.image)) ? [{ type: 'image', url: selectedVariant.image }] : []),
    ...(product.images || []).map((url) => ({ type: 'image', url })),
    ...(product.videos || []).map((url) => ({ type: 'video', url })),
  ];
  const activeMedia = gallery[selectedImage] || gallery[0] || { type: 'image', url: '/placeholder-perfume.svg' };
  const displayImage = activeMedia.type === 'image' ? activeMedia.url : product.images?.[0];
  const selectMedia = (index) => setSelectedImage((index + gallery.length) % gallery.length);
  const toNotes = (value) => Array.isArray(value) ? value : String(value || '').split(',').map(note => note.trim()).filter(Boolean);
  const topNotes = toNotes(product.top_notes);
  const middleNotes = toNotes(product.middle_notes);
  const baseNotes = toNotes(product.base_notes);
  const fallbackNotes = toNotes(product.specifications?.Notes || product.specifications?.notes);
  const hasNotePyramid = topNotes.length + middleNotes.length + baseNotes.length > 0;
  const scentFamily = product.fragrance_family || product.specifications?.['Fragrance Family'] || 'Signature blend';
  const concentration = product.concentration || product.specifications?.Concentration || 'Eau de Parfum';
  const sizeMl = Number(selectedVariant?.size_ml || String(selectedSize).match(/\d+/)?.[0] || 0);
  const pricePerMl = sizeMl > 0 ? Math.round(displayPrice / sizeMl) : null;

  return (
    <div className="min-h-screen bg-[#f7f3ed] text-stone-900">
      <Seo
        title={product.seo_title || product.name}
        description={product.seo_description || product.short_description || product.description}
        canonicalPath={`/customer/product/${product.slug || product.id}`}
        image={product.images?.[0]}
        type="product"
        schema={{
          '@context': 'https://schema.org', '@type': 'Product', name: product.name,
          description: product.short_description || product.description, image: product.images,
          sku: product.sku, brand: { '@type': 'Brand', name: product.brand || 'Perfurm' },
          offers: { '@type': 'Offer', priceCurrency: 'INR', price: displayPrice, availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url: `${window.location.origin}/customer/product/${product.slug || product.id}` },
          ...(product.review_count > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: product.average_rating, reviewCount: product.review_count } } : {}),
        }}
      />
      <div className="mx-auto max-w-[1440px] px-3 py-4 sm:px-6 sm:py-7 lg:px-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 mb-4 overflow-hidden whitespace-nowrap">
          <span onClick={() => navigate('/')} className="cursor-pointer hover:text-blue-600">Home</span>
          <ChevronRight className="w-4 h-4" />
          <span onClick={() => navigate(`/customer/category/${product.category}`)} className="cursor-pointer hover:text-blue-600">{product.category}</span>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-900 truncate">{product.name}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(390px,.92fr)] lg:gap-10 xl:gap-14">
          {/* Images Section */}
          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <Card className="overflow-hidden border-stone-200/80 bg-[#eee7dd] shadow-[0_24px_70px_-35px_rgba(60,38,30,.45)]">
              <CardContent className="p-3 sm:p-5">
                <div className="group relative mb-4 aspect-[4/5] max-h-[720px] overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_34%,#fff_0%,#eee6da_48%,#ded2c2_100%)]">
                  <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2"><Badge className="bg-stone-950 text-white hover:bg-stone-950">{concentration}</Badge>{product.is_new_arrival && <Badge className="bg-[#7d4956] text-white">New ritual</Badge>}{discount > 0 && <Badge className="bg-white text-[#6f3b49] shadow-sm">Save {discount}%</Badge>}</div>
                   <AnimatePresence mode="wait">
                     {activeMedia.type === 'video' ? <motion.video key={activeMedia.url} src={activeMedia.url} controls muted playsInline preload="metadata" className="h-full w-full bg-stone-950 object-contain" aria-label={`${product.name} product video`} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} /> : <motion.img key={activeMedia.url} src={activeMedia.url} alt={product.name} className="h-full w-full cursor-zoom-in object-contain p-5 mix-blend-multiply transition-transform duration-700 group-hover:scale-[1.025] sm:p-10" onClick={() => setShowImageZoom(true)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />}
                   </AnimatePresence>
                   {gallery.length > 1 && <><button type="button" onClick={() => selectMedia(selectedImage - 1)} className="absolute left-3 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-md" aria-label="Previous product media"><ChevronLeft className="h-5 w-5"/></button><button type="button" onClick={() => selectMedia(selectedImage + 1)} className="absolute right-3 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-md" aria-label="Next product media"><ChevronRight className="h-5 w-5"/></button></>}
                  <button
                    onClick={toggleWishlist}
                    className="absolute right-4 top-4 z-20 rounded-full bg-white/90 p-2.5 shadow-lg backdrop-blur transition-transform hover:scale-105"
                    aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                  >
                    <Heart className={`w-6 h-6 ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
                  </button>
                </div>

                {/* Thumbnail Images */}
                 {gallery.length > 1 && (
                   <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-1" aria-label="Product media gallery">
                     {gallery.map((media, idx) => (
                       <button
                         key={`${media.type}-${media.url}`}
                         onClick={() => setSelectedImage(idx)}
                         className={`relative h-20 w-20 flex-shrink-0 snap-start overflow-hidden rounded-xl border-2 bg-[#eee7dd] ${
                           selectedImage === idx ? 'border-[#6f3b49]' : 'border-transparent hover:border-stone-300'
                         }`}
                         aria-label={`Show ${media.type} ${idx + 1}`}
                       >
                         {media.type === 'video' ? <><video src={media.url} muted playsInline preload="metadata" className="h-full w-full bg-stone-900 object-cover"/><span className="absolute inset-0 grid place-items-center bg-black/20"><Play className="h-6 w-6 fill-white text-white"/></span></> : <img src={media.url} alt={`${product.name} view ${idx + 1}`} className="h-full w-full object-contain p-1 mix-blend-multiply" />}
                      </button>
                    ))}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-4">
                  <Button variant="outline" onClick={shareProduct} className="w-full rounded-full border-stone-300 bg-white/60">
                    <Share2 className="w-4 h-4 mr-2" /> Share
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-stone-200 bg-white/70 p-3 text-center shadow-sm">
              <div className="px-1"><Award className="mx-auto h-5 w-5 text-[#7d4956]"/><p className="mt-1 text-xs font-semibold sm:text-sm">Authentic</p><p className="hidden text-xs text-stone-500 sm:block">Quality checked</p></div>
              <div className="border-x border-stone-200 px-1"><Shield className="mx-auto h-5 w-5 text-[#7d4956]"/><p className="mt-1 text-xs font-semibold sm:text-sm">Secure</p><p className="hidden text-xs text-stone-500 sm:block">Protected checkout</p></div>
              <div className="px-1"><RotateCcw className="mx-auto h-5 w-5 text-[#7d4956]"/><p className="mt-1 text-xs font-semibold sm:text-sm">Easy support</p><p className="hidden text-xs text-stone-500 sm:block">Policy-backed help</p></div>
            </div>
          </div>

          {/* Product Details Section */}
          <div className="space-y-5 lg:pt-2">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.24em] text-[#7d4956]">{product.brand || 'Perfurm'} · {scentFamily}</p>
              <h1 className="display-serif text-4xl font-semibold leading-[1.05] sm:text-5xl">{product.name}</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">{product.short_description || product.description}</p>
            </div>

            {/* Rating */}
            <button type="button" onClick={() => document.getElementById('product-reviews')?.scrollIntoView({ behavior: 'smooth' })} className="flex w-fit items-center gap-3 rounded-full border border-stone-200 bg-white px-3 py-2 text-left shadow-sm">
              <div className="flex items-center gap-1 rounded-full bg-[#5f342f] px-2.5 py-1 text-white">
                <span className="font-semibold">{avgRating}</span>
                <Star className="w-4 h-4 fill-white" />
              </div>
              <span className="text-sm text-stone-600">{totalReviews.toLocaleString()} verified ratings</span>
              <ChevronRight className="h-4 w-4 text-stone-400"/>
            </button>

            {/* Price */}
            <Card className="border-[#dbcac3] bg-gradient-to-br from-[#fffaf5] to-[#f2e9e1] shadow-none">
              <CardContent className="p-5">
                <div className="flex items-baseline gap-3 mb-2">
                  <span data-testid="product-price" className="text-4xl font-semibold tracking-tight text-[#4b2927]">₹{displayPrice.toLocaleString('en-IN')}</span>
                  {displayMrp > displayPrice && (
                    <>
                      <span className="text-lg text-stone-400 line-through">₹{displayMrp.toLocaleString('en-IN')}</span>
                      <Badge className="bg-[#7d4956] px-3 text-sm text-white">{discount}% off</Badge>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600"><span>Inclusive of applicable taxes</span>{pricePerMl && <span>₹{pricePerMl}/ml</span>}</div>
                {displayMrp > displayPrice && <p className="mt-2 font-semibold text-emerald-700">You save ₹{(displayMrp - displayPrice).toLocaleString('en-IN')}</p>}
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 overflow-hidden rounded-2xl bg-[#211c1b] text-white shadow-sm">
              <div className="p-3 sm:p-4"><Droplets className="h-5 w-5 text-[#d9b9ad]"/><p className="mt-2 text-xs font-semibold sm:text-sm">{concentration}</p><p className="mt-1 hidden text-xs text-white/55 sm:block">A considered concentration</p></div>
              <div className="border-x border-white/10 p-3 sm:p-4"><Sparkles className="h-5 w-5 text-[#d9b9ad]"/><p className="mt-2 text-xs font-semibold sm:text-sm">{product.target_category || 'For every story'}</p><p className="mt-1 hidden text-xs text-white/55 sm:block">Wear it your way</p></div>
              <div className="p-3 sm:p-4"><Leaf className="h-5 w-5 text-[#d9b9ad]"/><p className="mt-2 text-xs font-semibold sm:text-sm">{scentFamily}</p><p className="mt-1 hidden text-xs text-white/55 sm:block">Fragrance family</p></div>
            </div>

            {/* Size Selection */}
            <div>
              <div className="mb-3 flex items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#7d4956]">Choose your bottle</p><h3 className="mt-1 font-semibold">Select size</h3></div><span className="text-xs text-stone-500">Price updates with size</span></div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(activeVariants.length > 0 ? activeVariants.map((variant) => ({
                  key: variant.id,
                  label: variant.label || (variant.size_ml ? `${variant.size_ml} ml` : variant.sku),
                  price: variant.price,
                  disabled: Number(variant.stock_quantity ?? 0) <= 0,
                })) : (product.sizes || []).map((size) => ({ key: size, label: size, disabled: false }))).map((option) => (
                  <button
                    key={option.key}
                    onClick={() => setSelectedSize(option.label)}
                    disabled={option.disabled}
                    className={`min-h-16 rounded-xl border-2 px-3 py-3 text-left font-semibold transition-all ${
                      selectedSize === option.label
                        ? 'border-[#6f3b49] bg-[#fff8f4] text-[#5d2d3a] shadow-sm'
                        : 'border-stone-200 bg-white hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-40'
                    }`}
                  >
                    <span className="block text-sm">{option.label}</span>{option.price != null && <span className="mt-1 block text-xs font-medium text-stone-500">₹{Number(option.price).toLocaleString('en-IN')}</span>}
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
                    {deliveryInfo.available ? <p className="flex items-center gap-2 text-green-600">
                      <Check className="w-4 h-4" /> Delivery in {deliveryInfo.estimatedDays} days
                    </p> : <p className="flex items-center gap-2 text-red-600"><X className="w-4 h-4" /> Delivery unavailable for this pincode</p>}
                    {deliveryInfo.available && deliveryInfo.cod && (
                      <p className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" /> Cash on Delivery available
                      </p>
                    )}
                    {deliveryInfo.available && Number(deliveryInfo.deliveryCharge) > 0 && <p>Delivery charge: ₹{deliveryInfo.deliveryCharge}</p>}
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
            <div className="flex gap-2 sm:gap-3 sticky bottom-0 z-20 bg-white/95 backdrop-blur p-3 sm:p-4 -mx-3 sm:-mx-4 border-t">
              <Button
                onClick={addToCart}
                variant="outline"
                className="flex-1 h-12 sm:h-14 text-sm sm:text-lg px-2 sm:px-4"
                disabled={product.is_coming_soon || !inStock || !selectedSize}
              >
                <ShoppingCart className="w-5 h-5 mr-2" /> {product.is_coming_soon ? 'Coming Soon' : 'Add to Cart'}
              </Button>
              <Button
                onClick={buyNow}
                className="flex-1 h-12 sm:h-14 text-sm sm:text-lg px-2 sm:px-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                disabled={product.is_coming_soon || !inStock || !selectedSize}
              >
                <Zap className="w-5 h-5 mr-2" /> Buy Now
              </Button>
            </div>
          </div>
        </div>

        {/* Fragrance Story */}
        <section className="mt-12 overflow-hidden rounded-3xl bg-[#211c1b] text-white shadow-xl sm:mt-16" aria-labelledby="fragrance-story-title">
          <div className="grid lg:grid-cols-[.72fr_1.28fr]">
            <div className="border-b border-white/10 p-6 sm:p-9 lg:border-b-0 lg:border-r">
              <p className="text-[11px] font-semibold uppercase tracking-[.24em] text-[#d9b9ad]">Inside the fragrance</p>
              <h2 id="fragrance-story-title" className="display-serif mt-3 text-3xl font-semibold sm:text-4xl">A scent that unfolds with you.</h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-white/65">From the first impression to the final trace on skin, discover the notes and character that shape {product.name}.</p>
              <div className="mt-7 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><Clock3 className="h-5 w-5 text-[#d9b9ad]"/><p className="mt-2 text-xs text-white/50">Longevity</p><p className="mt-1 font-semibold">{product.longevity || 'All-day presence'}</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><Wind className="h-5 w-5 text-[#d9b9ad]"/><p className="mt-2 text-xs text-white/50">Sillage</p><p className="mt-1 font-semibold">{product.sillage || 'Considered trail'}</p></div>
              </div>
            </div>
            <div className="p-6 sm:p-9">
              {hasNotePyramid ? <div className="grid gap-4 sm:grid-cols-3">
                <NoteChapter number="01" title="The opening" subtitle="Top notes" notes={topNotes}/>
                <NoteChapter number="02" title="The character" subtitle="Heart notes" notes={middleNotes}/>
                <NoteChapter number="03" title="The memory" subtitle="Base notes" notes={baseNotes}/>
              </div> : fallbackNotes.length > 0 ? <div><p className="text-xs uppercase tracking-[.2em] text-white/50">Signature notes</p><div className="mt-5 flex flex-wrap gap-2">{fallbackNotes.map(note => <span key={note} className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm">{note}</span>)}</div></div> : <p className="text-white/60">The complete note story will be revealed soon.</p>}
              {(product.seasons?.length > 0 || product.occasions?.length > 0) && <div className="mt-8 grid gap-5 border-t border-white/10 pt-6 sm:grid-cols-2">{product.seasons?.length > 0 && <div><p className="text-xs uppercase tracking-[.18em] text-white/45">Made for</p><p className="mt-2 text-sm text-white/80">{product.seasons.join(' · ')}</p></div>}{product.occasions?.length > 0 && <div><p className="text-xs uppercase tracking-[.18em] text-white/45">Wear it when</p><p className="mt-2 text-sm text-white/80">{product.occasions.join(' · ')}</p></div>}</div>}
            </div>
          </div>
        </section>

        {/* Additional Details Tabs */}
        <Card className="mt-8 overflow-hidden border-stone-200 bg-white/80 shadow-sm" id="product-reviews">
          <CardContent className="p-3 sm:p-6">
            <Tabs defaultValue="details">
              <TabsList className="flex w-full justify-start overflow-x-auto no-scrollbar">
                <TabsTrigger value="details" className="flex-shrink-0">Product Details</TabsTrigger>
                <TabsTrigger value="specifications">Specifications</TabsTrigger>
                <TabsTrigger value="reviews">Reviews ({totalReviews})</TabsTrigger>
                <TabsTrigger value="qa">Q&A</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Why it belongs in your ritual</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span>{concentration} crafted for a lasting, expressive wear.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span>{scentFamily} character with a layered fragrance journey.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span>Authenticity checked and packed with care by Perfurm.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span>Available in carefully selected bottle sizes, each with transparent pricing.</span>
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
          <img src={displayImage} alt={product.name} className="w-full" />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NoteChapter({ number, title, subtitle, notes }) {
  return <article className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
    <div className="flex items-center justify-between"><span className="text-xs font-semibold text-[#d9b9ad]">{number}</span><Droplets className="h-4 w-4 text-white/30"/></div>
    <h3 className="display-serif mt-8 text-2xl">{title}</h3>
    <p className="mt-1 text-[10px] uppercase tracking-[.18em] text-white/40">{subtitle}</p>
    {notes.length > 0 ? <div className="mt-5 flex flex-wrap gap-2">{notes.map(note => <span key={note} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/80">{note}</span>)}</div> : <p className="mt-5 text-sm text-white/45">To be revealed</p>}
  </article>;
}
