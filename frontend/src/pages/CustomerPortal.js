import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { useConsent } from '@/contexts/ConsentContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { ShoppingCart, User, Search, Menu, Star, Heart, Package, Bell, LogOut, Home, Shirt, Baby, Gem, Snowflake, Percent, Footprints, Sparkles, HelpCircle, ChevronLeft, ChevronRight, Settings, Eye, TrendingUp, X, Phone, Mail, Facebook, Instagram, Twitter, Youtube, ChevronDown, ShieldCheck, Truck, RefreshCw, Gift, ArrowUpRight, Quote, CheckCheck, Copy, Check, Volume2, VolumeX, Clock3, Crown } from 'lucide-react';
import ProductDetails from './customer/ProductDetails';
import CartPage from './customer/CartPage';
import CheckoutPage from './customer/CheckoutPage';
import MyOrders from './customer/MyOrders';
import SupportCenter from './customer/SupportCenter';
import CategoryPage from './customer/CategoryPage';
import WishlistPage from './customer/WishlistPage';
import ProfilePage from './customer/ProfilePage';
import SettingsPage from './customer/SettingsPage';
import OrderTracking from './customer/OrderTracking';
import ReturnRequest from './customer/ReturnRequest';
import EnhancedProfilePage from './customer/EnhancedProfilePage';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import BrandMark from '@/components/BrandMark';
import BottleLoader from '@/components/BottleLoader';
import Seo from '@/components/Seo';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const categories = [
  { 
    label: 'For Him',
    icon: Shirt, 
    color: 'text-blue-600',
    subcategories: ['Woody', 'Fresh', 'Aquatic', 'Spicy', 'Leather']
  },
  { 
    label: 'For Her',
    icon: Gem, 
    color: 'text-pink-500',
    subcategories: ['Floral', 'Fruity', 'Amber', 'Gourmand', 'Musk']
  },
  { 
    label: 'Unisex',
    icon: Baby, 
    color: 'text-amber-500',
    subcategories: ['Clean', 'Citrus', 'Green', 'Aromatic', 'Niche']
  },
  { 
    label: 'Home Scents',
    icon: Star, 
    color: 'text-purple-600',
    subcategories: ['Candles', 'Diffusers', 'Room Sprays', 'Incense']
  },
  { 
    label: 'New Arrivals', 
    icon: Sparkles, 
    color: 'text-rose-500',
    subcategories: []
  },
  { label: 'Coming Soon', icon: Clock3, color: 'text-violet-600', subcategories: [] },
  { 
    label: 'Sale', 
    icon: Percent, 
    color: 'text-red-600',
    subcategories: ['Clearance', 'Flash Sales', 'Bundle Deals']
  },
  { 
    label: 'Discovery Sets',
    icon: Snowflake, 
    color: 'text-sky-600',
    subcategories: ['For Him', 'For Her', 'Unisex', 'Build Your Own']
  },
  { 
    label: 'Gifting',
    icon: Footprints, 
    color: 'text-green-600',
    subcategories: ['Gift Sets', 'Miniatures', 'Under ₹2,000', 'Luxury Gifts']
  },
];

const scentFamilies = [
  { name: 'Floral', note: 'Rose, jasmine & iris', image: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=700', category: 'For Her' },
  { name: 'Woods', note: 'Oud, cedar & vetiver', image: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=700', category: 'For Him' },
  { name: 'Fresh', note: 'Citrus, tea & sea salt', image: 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=700', category: 'Unisex' },
  { name: 'Amber', note: 'Vanilla, spice & resin', image: 'https://images.unsplash.com/photo-1501183638710-841dd1904471?w=700', category: 'For Her' },
];

const previewReviews = ['Aarohi', 'Kabir', 'Meera', 'Vihaan', 'Ananya', 'Reyansh', 'Ishita', 'Arjun', 'Saanvi', 'Dev'].map((name, index) => ({
  id: `preview-review-${index + 1}`,
  customer_name: name,
  rating: index === 5 || index === 7 ? 4 : 5,
  comment: ['The discovery journey felt personal and unhurried. The scent developed beautifully through the day.', 'Excellent projection without becoming overpowering. The bottle and packaging feel genuinely premium.', 'I started with the smaller bottle and came back for the full size. Choosing a variant was easy.'][index % 3],
}));

const servicePromises = [
  { icon: ShieldCheck, title: '100% authentic', copy: 'Sourced only from verified fragrance houses' },
  { icon: Truck, title: 'Complimentary delivery', copy: 'Free shipping on orders above Rs. 1,499' },
  { icon: RefreshCw, title: 'Easy exchanges', copy: 'A simple 7-day exchange promise' },
  { icon: Gift, title: 'Signature gifting', copy: 'Wrapped by hand with a personal note' },
];

function ProductCard({ product, onClick }) {
  const discount = Math.round(((product.mrp - product.price) / product.mrp) * 100);
  
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="perfurm-product-card cursor-pointer transition-all duration-300 group overflow-hidden" onClick={onClick} data-testid={`product-card-${product.id}`}>
        <CardContent className="p-0">
          <div className="h-40 sm:h-44 lg:h-48 bg-[#f2eee8] relative overflow-hidden p-3 sm:p-4">
            {product.images && product.images[0] ? (
              <img src={product.images[0]} alt={product.name} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-[1.03] transition-transform duration-500" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Package className="w-12 h-12 text-gray-400" /></div>
            )}
            {discount > 0 && (
              <Badge className="absolute top-2.5 right-2.5 bg-white/95 text-[#6f3b49] border border-[#6f3b49]/15 shadow-none text-[10px] tracking-wide">{discount}% OFF</Badge>
            )}
            <button type="button" aria-label={`Add ${product.name} to wishlist`} className="absolute top-2.5 left-2.5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity bg-white/95 rounded-full p-2 border border-stone-200 hover:text-[#6f3b49]">
              <Heart className="w-4 h-4 hover:text-red-500" />
            </button>
          </div>
          <div className="p-3.5 sm:p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#8b6f68] mb-1.5 truncate">{product.category}</p>
            <h3 className="display-serif text-[15px] sm:text-base font-semibold leading-snug line-clamp-2 min-h-[40px]">{product.name}</h3>
            <div className="flex flex-wrap items-baseline gap-x-2 mt-2.5">
              <span className="font-bold text-lg">₹{product.price}</span>
              {product.mrp > product.price && (
                <span className="text-sm text-gray-600 line-through">₹{product.mrp}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SearchBar({ onClose }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState({ suggestions: [], products: [] });
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (query.length >= 2) {
        fetchSuggestions();
      } else {
        setSuggestions({ suggestions: [], products: [] });
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const fetchSuggestions = async () => {
    try {
      const response = await axios.get(`${API_URL}/search/suggestions`, { params: { q: query } });
      setSuggestions(response.data);
      setShowResults(true);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const showSearchRecommendations = async () => {
    if (query.length >= 2) return setShowResults(true);
    try {
      const response = await axios.get(`${API_URL}/catalog/bestsellers`, { params: { limit: 5 } });
      setSuggestions({ suggestions: [], products: response.data || [] });
      setShowResults(true);
    } catch (_) { setShowResults(false); }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/customer/search?q=${encodeURIComponent(query)}`);
      setShowResults(false);
      if (onClose) onClose();
    }
  };

  const handleProductClick = (productId) => {
    navigate(`/customer/product/${productId}`);
    setShowResults(false);
    if (onClose) onClose();
  };

  return (
    <form onSubmit={handleSearch} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input
          ref={inputRef}
          placeholder="Search fragrances, notes and houses..."
          className="pl-10 pr-10"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={showSearchRecommendations}
          data-testid="search-input"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setSuggestions({ suggestions: [], products: [] }); }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* Search Results Dropdown */}
      <AnimatePresence>
        {showResults && (suggestions.suggestions.length > 0 || suggestions.products.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border z-50 max-h-96 overflow-y-auto"
          >
            {/* Category Suggestions */}
            {suggestions.suggestions.length > 0 && (
              <div className="p-2 border-b">
                <p className="text-xs text-gray-500 px-2 mb-1">Categories</p>
                {suggestions.suggestions.map((cat, idx) => (
                  <button
                    key={idx}
                    onClick={() => { navigate(`/customer/category/${cat}`); setShowResults(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded flex items-center gap-2"
                  >
                    <Search className="w-4 h-4 text-gray-400" />
                    <span>{cat}</span>
                  </button>
                ))}
              </div>
            )}
            
            {/* Product Suggestions */}
            {suggestions.products.length > 0 && (
              <div className="p-2">
                <p className="text-xs text-gray-500 px-2 mb-1">{query.length >= 2 ? 'Products' : 'Bestseller recommendations'}</p>
                {suggestions.products.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleProductClick(product.id)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded flex items-center gap-3"
                  >
                    {product.images?.[0] && (
                      <img src={product.images[0]} alt="" className="w-10 h-10 rounded object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{product.name}</p>
                      <p className="text-sm text-gray-500">₹{product.price}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}

function HomePage() {
  const consent = useConsent();
  const [products, setProducts] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [trending, setTrending] = useState([]);
  const [mostViewed, setMostViewed] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState(null);
  const [offerIndex, setOfferIndex] = useState(0);
  const [tickerMessage, setTickerMessage] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [visibility, setVisibility] = useState({
    show_hero_banner: true,
    show_ticker: true,
    show_categories: true,
    show_most_viewed: true,
    show_trending: true,
    show_bestsellers: true,
    show_new_arrivals: true,
    show_offer_cards: true,
    show_bank_offers: true,
    show_view_store: true,
    show_footer: true
  });
  const [bestsellers, setBestsellers] = useState([]);
  const [heroBanners, setHeroBanners] = useState([]);
  const [offerCards, setOfferCards] = useState([]);
  const [bankOffers, setBankOffers] = useState([]);
  const [activeCoupons, setActiveCoupons] = useState([]);
  const [copiedOfferCode, setCopiedOfferCode] = useState('');
  const [offerPopupOpen, setOfferPopupOpen] = useState(false);
  const [topReviews, setTopReviews] = useState(previewReviews);
  const [creatorCampaigns, setCreatorCampaigns] = useState([]);
  const [footerContent, setFooterContent] = useState(null);
  const heroTouchStartX = useRef(null);
  const categoryRailRef = useRef(null);
  const categoryDrag = useRef({ startX: 0, scrollLeft: 0, moved: false });
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const visitorId = useRef(null);
  if (consent.hasConsent('analytics') && !visitorId.current) {
    visitorId.current = localStorage.getItem('perfurm_visitor_id') || (window.crypto?.randomUUID?.() || `visitor-${Date.now()}-${Math.random()}`);
    localStorage.setItem('perfurm_visitor_id', visitorId.current);
  }

  const defaultOffers = [
    { title: 'Find the scent that stays', subtitle: 'An edited collection of modern, memorable fragrance', cta: 'Explore fragrances', image: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=1400', media_type: 'image', link: '/customer/category/all' },
    { title: 'The art of the discovery set', subtitle: 'Try them slowly. Choose the one that feels like you.', cta: 'Discover sets', image: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?w=1400', media_type: 'image', link: '/customer/category/Discovery%20Sets' },
    { title: 'A beautiful way to be remembered', subtitle: 'Considered fragrance gifts for every occasion', cta: 'Shop gifting', image: 'https://images.unsplash.com/photo-1588405748880-12d1d2a59f75?w=1400', media_type: 'image', link: '/customer/category/Gifting' },
  ];
  const offers = heroBanners.length > 0
    ? heroBanners.map((banner) => ({ title: banner.title, subtitle: banner.subtitle, cta: banner.button_text, image: banner.image_url, media_type: banner.media_type || 'image', link: banner.button_link || '/customer/category/all' }))
    : defaultOffers;
  const popupCoupon = activeCoupons[0];

  useEffect(() => {
    if (!popupCoupon || (consent.hasConsent('functional') && sessionStorage.getItem(`perfurm_offer_popup_${popupCoupon.id}`))) return;
    const timer = window.setTimeout(() => setOfferPopupOpen(true), 1400);
    return () => window.clearTimeout(timer);
  }, [popupCoupon?.id]);

  const dismissOfferPopup = () => {
    if (popupCoupon && consent.hasConsent('functional')) sessionStorage.setItem(`perfurm_offer_popup_${popupCoupon.id}`, 'dismissed');
    setOfferPopupOpen(false);
  };

  useEffect(() => {
    fetchProducts();
    fetchTrending();
    fetchMostViewed();
    fetchCategories();
    fetchTicker();
    fetchVisibility();
    fetchBestsellers();
    fetchHeroBanners();
    fetchPromotions();
    fetchTopReviews();
    fetchCreatorCampaigns();
    fetchFooterContent();
    loadCart();
    if (user) {
      fetchNotifications();
    }
  }, [selectedCategory, user]);

  useEffect(() => {
    const refreshCms = () => Promise.allSettled([
      fetchTicker(), fetchVisibility(), fetchHeroBanners(), fetchPromotions(), fetchFooterContent(), fetchCategories(),
    ]);
    const interval = window.setInterval(refreshCms, 120000);
    const handleFocus = () => refreshCms();
    window.addEventListener('focus', handleFocus);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', handleFocus); };
  }, []); // Keep CMS-controlled content synchronized while the storefront remains open.

  useEffect(() => {
    if (reduceMotion) return undefined;
    const interval = setInterval(() => {
      setOfferIndex((prev) => (prev + 1) % offers.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [offers.length, reduceMotion]);

  const loadCart = () => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  };

  const fetchProducts = async () => {
    try {
      const params = {};
      if (selectedCategory) params.category = selectedCategory;
      const response = await axios.get(`${API_URL}/products`, { params });
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const fetchTrending = async () => {
    try {
      const response = await axios.get(`${API_URL}/products/trending`, { params: { limit: 8 } });
      setTrending(response.data);
    } catch (error) {
      console.error('Error fetching trending:', error);
    }
  };

  const fetchMostViewed = async () => {
    try {
      const response = await axios.get(`${API_URL}/products/most-viewed`, { params: { limit: 8 } });
      setMostViewed(response.data);
    } catch (error) {
      console.error('Error fetching most viewed:', error);
    }
  };

  const fetchVisibility = async () => {
    try {
      const response = await axios.get(`${API_URL}/storefront-visibility`);
      setVisibility(response.data);
    } catch (error) {
      console.error('Error fetching visibility:', error);
    }
  };

  const fetchBestsellers = async () => {
    try {
      const response = await axios.get(`${API_URL}/catalog/bestsellers`, { params: { limit: 8 } });
      setBestsellers(response.data);
    } catch (error) {
      console.error('Error fetching bestsellers:', error);
    }
  };

  const fetchHeroBanners = async () => {
    try {
      const response = await axios.get(`${API_URL}/hero-banners`);
      setHeroBanners(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching hero banners:', error);
    }
  };

  const fetchPromotions = async () => {
    const results = await Promise.allSettled([
        axios.get(`${API_URL}/offer-cards`),
        axios.get(`${API_URL}/bank-offers`),
        axios.get(`${API_URL}${user ? '/coupons/mine' : '/coupons/active'}`),
    ]);
    const [offersResult, banksResult, couponsResult] = results;
    if (offersResult.status === 'fulfilled') setOfferCards(Array.isArray(offersResult.value.data) ? offersResult.value.data : []);
    else console.error('Error fetching offer cards:', offersResult.reason);
    if (banksResult.status === 'fulfilled') setBankOffers(Array.isArray(banksResult.value.data) ? banksResult.value.data : []);
    else console.error('Error fetching bank offers:', banksResult.reason);
    if (couponsResult.status === 'fulfilled') setActiveCoupons(Array.isArray(couponsResult.value.data) ? couponsResult.value.data : []);
    else console.error('Error fetching coupons:', couponsResult.reason);
  };

  const fetchTopReviews = async () => {
    try {
      const response = await axios.get(`${API_URL}/storefront/reviews/top`, { params: { limit: 10 } });
      setTopReviews(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching top reviews:', error);
    }
  };

  const fetchCreatorCampaigns = async () => {
    try {
      const response = await axios.get(`${API_URL}/creator-campaigns`, { params: visitorId.current ? { visitor_id: visitorId.current } : {} });
      setCreatorCampaigns(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching creator campaigns:', error);
    }
  };

  const toggleCampaignLike = async (campaign) => {
    if (!consent.hasConsent('analytics') || !visitorId.current) { consent.openPreferences(); return; }
    const previous = creatorCampaigns;
    setCreatorCampaigns(items => items.map(item => item.id === campaign.id ? { ...item, liked_by_visitor: !item.liked_by_visitor, likes: Math.max(0, (item.likes || 0) + (item.liked_by_visitor ? -1 : 1)) } : item).sort((a, b) => (b.likes || 0) - (a.likes || 0) || (a.display_order || 0) - (b.display_order || 0)));
    try {
      await axios.post(`${API_URL}/creator-campaigns/${campaign.id}/events`, { visitor_id: visitorId.current, event_type: 'like', source: campaign.social_channel, referrer: document.referrer || null });
    } catch (error) {
      setCreatorCampaigns(previous);
      toast.error('Could not update your like');
    }
  };

  const finishHeroSwipe = (clientX) => {
    if (heroTouchStartX.current == null) return;
    const distance = clientX - heroTouchStartX.current;
    heroTouchStartX.current = null;
    if (Math.abs(distance) < 45) return;
    setOfferIndex((current) => distance < 0 ? (current + 1) % offers.length : (current - 1 + offers.length) % offers.length);
  };

  const startCategoryDrag = (event) => {
    categoryDrag.current = { startX: event.clientX, scrollLeft: categoryRailRef.current?.scrollLeft || 0, moved: false };
  };

  const moveCategoryDrag = (event) => {
    if (!categoryRailRef.current || !event.buttons && event.pointerType === 'mouse') return;
    const distance = event.clientX - categoryDrag.current.startX;
    if (Math.abs(distance) > 6) categoryDrag.current.moved = true;
    if (event.pointerType === 'mouse' && categoryDrag.current.moved) categoryRailRef.current.scrollLeft = categoryDrag.current.scrollLeft - distance;
  };

  const blockCategoryClickAfterDrag = (event) => {
    if (!categoryDrag.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    categoryDrag.current.moved = false;
  };

  const showOffers = () => {
    setMenuOpen(false);
    navigate('/customer/offers');
  };

  const copyOfferCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedOfferCode(code);
      window.setTimeout(() => setCopiedOfferCode(current => current === code ? '' : current), 2000);
      toast.success(`${code} copied — apply it at checkout`);
    } catch {
      toast.info(`Use code ${code} at checkout`);
    }
  };

  const fetchFooterContent = async () => {
    try {
      const response = await axios.get(`${API_URL}/footer-content`);
      setFooterContent(response.data);
    } catch (error) {
      console.error('Error fetching footer content:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API_URL}/categories`);
      setAllCategories(response.data.categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchTicker = async () => {
    try {
      const response = await axios.get(`${API_URL}/ticker/active`);
      setTickerMessage(response.data.message);
    } catch (error) {
      console.error('Error fetching ticker:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`${API_URL}/notifications/my`);
      setNotifications(response.data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.is_read) {
      try {
        await axios.put(`${API_URL}/notifications/${notification.id}/read`);
        setNotifications(prev => 
          prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
        );
      } catch (error) {
        toast.error('Could not update notification. Please try again.');
        return;
      }
    }
    
    // Navigate to link if provided
    if (notification.link_url?.startsWith('/')) {
      setShowNotifications(false);
      navigate(notification.link_url);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await axios.put(`${API_URL}/notifications/read-all`);
      setNotifications(current => current.map(notification => ({ ...notification, is_read: true })));
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Could not update notifications');
    }
  };

  const deleteAllNotifications = async () => {
    if (!window.confirm('Delete all notifications? This cannot be undone.')) return;
    try {
      const response = await axios.delete(`${API_URL}/notifications/my`);
      setNotifications([]);
      toast.success(response.data.deleted_count ? 'All notifications deleted' : 'No notifications to delete');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not delete notifications');
    }
  };

  const goToCategory = (category, subcategory = null) => {
    const path = subcategory 
      ? `/customer/category/${category}?sub=${encodeURIComponent(subcategory)}`
      : `/customer/category/${category}`;
    navigate(path);
    setMenuOpen(false);
  };

  const unreadNotifications = notifications.filter(n => !n.is_read).length;

  if (initialLoading) {
    return <div className="min-h-screen perfurm-page"><BottleLoader label="Composing the RAW collection" /></div>;
  }

  return (
    <div className="min-h-screen perfurm-page">
      <Seo
        description="Discover expressive perfume, discovery sets, fragrance gifts and home scents selected by RAW."
        canonicalPath="/"
        schema={{
          '@context': 'https://schema.org', '@type': 'WebSite', name: 'RAW',
          url: window.location.origin,
          potentialAction: { '@type': 'SearchAction', target: `${window.location.origin}/customer/search?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
        }}
      />
      {/* Header */}
      <header className="bg-[#fffdf9]/95 backdrop-blur-md border-b border-stone-200/70 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 py-2.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open navigation menu" data-testid="menu-btn">
                    <Menu />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[88vw] max-w-sm overflow-y-auto border-r-0 bg-gradient-to-b from-[#fffdf9] to-[#f3eae4] p-0">
                  <SheetHeader>
                    <div className="border-b border-[#6f3b49]/10 px-6 py-6 text-left">
                      <BrandMark />
                      <SheetTitle className="display-serif mt-5 text-2xl">Explore your scent</SheetTitle>
                      <p className="mt-1 text-sm text-stone-500">Collections curated by mood, style and occasion.</p>
                    </div>
                  </SheetHeader>
                  <div className="space-y-2 p-4 pb-6">
                    <Button variant="ghost" className="h-12 w-full justify-start gap-3 rounded-xl bg-[#6f3b49] px-4 text-white hover:bg-[#5f303d] hover:text-white" onClick={showOffers}>
                      <Percent className="h-5 w-5" />
                      <span className="flex-1 text-left">Current offers</span>
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                    {categories.map((cat) => {
                      const Icon = cat.icon;
                      return (
                        <div key={cat.label}>
                          <Button
                            variant="ghost"
                            className={`h-12 w-full justify-start gap-3 rounded-xl px-4 ${expandedMenu === cat.label ? 'bg-[#6f3b49] text-white hover:bg-[#6f3b49] hover:text-white' : 'bg-white/70 hover:bg-white'}`}
                            onClick={() => cat.subcategories?.length ? setExpandedMenu(current => current === cat.label ? null : cat.label) : goToCategory(cat.label)}
                            data-testid={`menu-${cat.label.toLowerCase().replace(' ', '-')}`}
                          >
                            <Icon className={`w-5 h-5 ${cat.color}`} />
                            <span className="flex-1 text-left">{cat.label}</span>
                            {cat.subcategories?.length > 0 && <ChevronDown className={`h-4 w-4 transition-transform ${expandedMenu === cat.label ? 'rotate-180' : ''}`} />}
                          </Button>
                          <AnimatePresence initial={false}>
                          {expandedMenu === cat.label && cat.subcategories?.length > 0 && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="ml-5 overflow-hidden border-l border-[#6f3b49]/20 pl-4 pt-1">
                              <Button variant="ghost" size="sm" className="w-full justify-start text-[#6f3b49]" onClick={() => goToCategory(cat.label)}>Shop all {cat.label}</Button>
                              {cat.subcategories.map((sub) => (
                                <Button
                                  key={sub}
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-start text-gray-600 text-sm"
                                  onClick={() => goToCategory(cat.label, sub)}
                                >
                                  {sub}
                                </Button>
                              ))}
                            </motion.div>
                          )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </SheetContent>
              </Sheet>
              
              <motion.div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => { setSelectedCategory(null); navigate('/'); }}
                whileHover={{ scale: 1.02 }}
                data-testid="brand-logo"
              >
                <BrandMark />
              </motion.div>
            </div>
            
            <div className="hidden md:flex flex-1 max-w-xl">
              <SearchBar />
            </div>
            
            <div className="flex items-center gap-1">
              {/* Notifications */}
              {user && (
                <DropdownMenu open={showNotifications} onOpenChange={setShowNotifications}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative" data-testid="notifications-btn">
                      <Bell className="w-5 h-5" />
                      {unreadNotifications > 0 && (
                        <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500">
                          {unreadNotifications}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    <DropdownMenuLabel className="flex items-center justify-between gap-3">
                      <span>Notifications</span>
                      <span className="flex items-center gap-2">
                        {unreadNotifications > 0 && (
                          <button type="button" className="flex items-center gap-1 text-xs text-[#6f3b49] hover:underline" onClick={(event) => { event.preventDefault(); event.stopPropagation(); markAllNotificationsRead(); }}>
                            <CheckCheck className="h-3.5 w-3.5" /> Mark read
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <button type="button" className="text-xs text-red-600 hover:underline" onClick={(event) => { event.preventDefault(); event.stopPropagation(); deleteAllNotifications(); }}>
                            Delete all
                          </button>
                        )}
                      </span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">No notifications</div>
                    ) : (
                      notifications.slice(0, 5).map((notif) => (
                        <DropdownMenuItem 
                          key={notif.id} 
                          className={`flex flex-col items-start p-3 cursor-pointer ${!notif.is_read ? 'bg-blue-50' : ''}`}
                          onClick={() => handleNotificationClick(notif)}
                        >
                          <div className="flex items-start gap-2 w-full">
                            {!notif.is_read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                            )}
                            <div className="flex-1">
                              <p className={`font-medium ${!notif.is_read ? 'text-blue-600' : ''}`}>{notif.title}</p>
                              <p className="line-clamp-2 w-full text-sm text-gray-500">{notif.message}</p>
                              {notif.link_url && (
                                <p className="text-xs text-blue-500 mt-1">Click to view →</p>
                              )}
                            </div>
                          </div>
                        </DropdownMenuItem>
                      ))
                    )}
                    {notifications.length > 5 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-center text-blue-600 cursor-pointer"
                          onClick={() => {
                            setShowNotifications(false);
                            navigate('/customer/notifications');
                          }}
                        >
                          View all notifications
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Button variant="ghost" size="icon" onClick={() => navigate('/customer/support')} data-testid="support-btn" title="Help & Support" className="hidden sm:inline-flex">
                <HelpCircle className="w-5 h-5" />
              </Button>

              <Button variant="outline" size="sm" onClick={showOffers} className="hidden rounded-full border-[#6f3b49]/25 text-[#6f3b49] sm:inline-flex">
                <Percent className="mr-1.5 h-4 w-4" /> Offers
              </Button>
              
              <Button variant="ghost" size="icon" onClick={() => navigate('/customer/wishlist')} data-testid="wishlist-btn" title="Wishlist" className="hidden sm:inline-flex">
                <Heart className="w-5 h-5" />
              </Button>
              
              <Button variant="ghost" size="icon" className="relative" onClick={() => navigate('/customer/cart')} data-testid="cart-btn" title="Cart">
                <ShoppingCart className="w-5 h-5" />
                {cart.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {cart.length}
                  </Badge>
                )}
              </Button>
              
              {/* User Profile Dropdown */}
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid="user-menu-btn">
                      <User className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span>{user.name}</span>
                        <span className="text-xs font-normal text-gray-500">{user.email}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/customer/profile')}>
                      <User className="w-4 h-4 mr-2" /> My Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/customer/orders')}>
                      <Package className="w-4 h-4 mr-2" /> My Orders
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/customer/wishlist')}>
                      <Heart className="w-4 h-4 mr-2" /> Wishlist
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/customer/settings')}>
                      <Settings className="w-4 h-4 mr-2" /> Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/customer/support')}>
                      <HelpCircle className="w-4 h-4 mr-2" /> Help & Support
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-red-600">
                      <LogOut className="w-4 h-4 mr-2" /> Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="ghost" size="icon" onClick={() => navigate('/auth')} data-testid="login-btn" title="Login">
                  <User className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
          
          {/* Mobile Search */}
          <div className="md:hidden mt-3">
            <SearchBar />
          </div>
        </div>
      </header>

      {/* Sub-Header with Categories */}
      {visibility.show_categories && <div className="bg-[#fffdf9] border-b border-stone-200/70">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 py-2.5">
          <div
            ref={categoryRailRef}
            className="flex touch-pan-x select-none gap-1.5 overflow-x-auto overscroll-x-contain no-scrollbar cursor-grab active:cursor-grabbing"
            onPointerDown={startCategoryDrag}
            onPointerMove={moveCategoryDrag}
            onClickCapture={blockCategoryClickAfterDrag}
            aria-label="Product categories"
          >
            <Button
              variant={selectedCategory === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className="flex-shrink-0 rounded-full px-4 shadow-none"
              data-testid="category-all"
            >
              <Home className="w-4 h-4 mr-1" /> All
            </Button>
            {categories.map((cat) => {
              const Icon = cat.icon;
              if (cat.subcategories && cat.subcategories.length > 0) {
                return (
                  <div key={cat.label} className="flex-shrink-0">
                    <Button
                      variant={selectedCategory === cat.label ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => goToCategory(cat.label)}
                      className="rounded-full border-stone-200 px-4 shadow-none md:hidden"
                      data-testid={`category-${cat.label.toLowerCase().replace(' ', '-')}`}
                    >
                      <Icon className={`w-4 h-4 mr-1 ${cat.color}`} /> {cat.label}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                      <Button
                        variant={selectedCategory === cat.label ? 'default' : 'outline'}
                        size="sm"
                        className="hidden rounded-full px-4 shadow-none border-stone-200 md:inline-flex"
                        data-testid={`category-${cat.label.toLowerCase().replace(' ', '-')}-desktop`}
                      >
                        <Icon className={`w-4 h-4 mr-1 ${cat.color}`} /> {cat.label}
                        <ChevronDown className="w-3 h-3 ml-1" />
                      </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => goToCategory(cat.label)}>
                          All {cat.label}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {cat.subcategories.map((sub) => (
                          <DropdownMenuItem key={sub} onClick={() => goToCategory(cat.label, sub)}>
                            {sub}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              }
              return (
                <Button
                  key={cat.label}
                  variant={selectedCategory === cat.label ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => goToCategory(cat.label)}
                  className="flex-shrink-0 rounded-full px-4 shadow-none border-stone-200"
                  data-testid={`category-${cat.label.toLowerCase().replace(' ', '-')}`}
                >
                  <Icon className={`w-4 h-4 mr-1 ${cat.color}`} /> {cat.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>}

      {/* Ticker */}
      {visibility.show_ticker && tickerMessage && (
        <div className="bg-[#6f3b49] text-white overflow-hidden">
          <motion.div
            className="py-2 text-sm font-medium whitespace-nowrap"
            animate={{ x: ['100%', '-100%'] }}
            transition={{ repeat: Infinity, duration: 20, ease: 'linear' }}
          >
            {tickerMessage}
          </motion.div>
        </div>
      )}

      {/* Offers Slider */}
      {visibility.show_hero_banner && <section className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 mt-5 sm:mt-7">
        <div
          className="relative touch-pan-y rounded-[2px] overflow-hidden shadow-[0_24px_70px_rgba(55,40,35,0.16)]"
          onTouchStart={(event) => { heroTouchStartX.current = event.touches[0]?.clientX ?? null; }}
          onTouchEnd={(event) => finishHeroSwipe(event.changedTouches[0]?.clientX ?? 0)}
          onPointerDown={(event) => { heroTouchStartX.current = event.clientX; }}
          onPointerUp={(event) => { finishHeroSwipe(event.clientX); }}
          role="region"
          aria-roledescription="carousel"
          aria-label="Featured promotions"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={offerIndex}
              initial={false}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { x: -100 }}
              transition={{ duration: reduceMotion ? 0 : 0.5 }}
              className="relative h-[330px] sm:h-[410px] lg:h-[475px]"
            >
              {offers[offerIndex].media_type === 'video' ? <video src={offers[offerIndex].image} className="h-full w-full object-cover" autoPlay muted loop playsInline preload="metadata" aria-label={offers[offerIndex].title} /> : <img src={offers[offerIndex].image} alt="" className="w-full h-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-r from-stone-950/80 via-stone-950/45 to-transparent flex items-center">
                <div className="px-7 sm:px-14 lg:px-20 py-6 text-white max-w-2xl">
                  <p className="text-xs uppercase tracking-[0.28em] mb-3 text-stone-200">RAW · Olfactory stories</p>
                  <h2 className="display-serif text-4xl sm:text-5xl lg:text-[64px] leading-[0.98] font-semibold mb-5">{offers[offerIndex].title}</h2>
                  <p className="mb-6 text-sm sm:text-lg text-stone-200 max-w-lg leading-relaxed">{offers[offerIndex].subtitle}</p>
                  <Button onClick={() => navigate(offers[offerIndex].link)} className="bg-[#fffdf9] text-stone-900 hover:bg-white rounded-full px-7 h-11">
                    {offers[offerIndex].cta}
                  </Button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
          
          <button
            type="button"
            aria-label="Previous promotion"
            onClick={() => setOfferIndex((prev) => (prev - 1 + offers.length) % offers.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 transition-all hover:bg-white sm:left-4"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            aria-label="Next promotion"
            onClick={() => setOfferIndex((prev) => (prev + 1) % offers.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 transition-all hover:bg-white sm:right-4"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {offers.map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Show promotion ${idx + 1}`}
                aria-current={idx === offerIndex ? 'true' : undefined}
                onClick={() => setOfferIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === offerIndex ? 'bg-white w-8' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        </div>
      </section>}

      <section className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 mt-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 border-y border-stone-200 bg-[#fffdf9]">
          {servicePromises.map(({ icon: Icon, title, copy }, index) => (
            <div key={title} className={`flex gap-3 px-4 sm:px-6 py-5 ${index % 2 === 0 ? 'border-r' : ''} lg:border-r lg:last:border-r-0 border-stone-200`}>
              <Icon className="w-5 h-5 text-[#814b58] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.08em]">{title}</p>
                <p className="hidden sm:block text-xs text-stone-500 mt-1 leading-relaxed">{copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Main Content */}
      <div className="mx-auto flex max-w-[1600px] flex-col px-3 py-8 sm:px-5 sm:py-12 lg:px-8">
        {user && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl"
          >
            <p className="text-lg">Welcome back, <span className="font-semibold">{user.name}</span>! 👋</p>
          </motion.div>
        )}

        {products.length > 0 && <motion.section aria-label="House signature collection" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="order-[10] mb-12 overflow-hidden bg-[#171514] text-white sm:mb-16">
          <div className="grid lg:grid-cols-[.72fr_1.28fr]">
            <div className="flex flex-col justify-center border-b border-white/10 p-7 sm:p-10 lg:border-b-0 lg:border-r lg:p-14">
              <Crown className="h-7 w-7 text-[#d4ae72]" />
              <p className="mt-7 text-[10px] font-semibold uppercase tracking-[.32em] text-[#d4ae72]">The house signatures</p>
              <h2 className="display-serif mt-3 text-4xl leading-[1.02] sm:text-5xl">The signatures<br/>of our house.</h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-stone-300">Meet the fragrances that define the RAW house—from luminous freshness to a deep after-dark trail. Choose the character that feels unmistakably yours.</p>
              <Button onClick={() => navigate('/customer/category/all')} variant="outline" className="mt-7 w-fit rounded-full border-white/30 bg-transparent px-6 text-white hover:bg-white hover:text-stone-950">Discover the collection <ArrowUpRight className="ml-2 h-4 w-4"/></Button>
            </div>
            <div className="grid grid-cols-2">
              {products.slice(0, 4).map((product, index) => <button key={product.id} type="button" onClick={() => navigate(`/customer/product/${product.slug || product.id}`)} className="group relative min-h-[245px] overflow-hidden border-white/10 text-left even:border-l sm:min-h-[330px] lg:min-h-[390px]">
                <img src={product.images?.[0] || '/placeholder-perfume.svg'} alt={product.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-transparent" />
                <span className="absolute left-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-white/35 bg-black/20 text-xs backdrop-blur sm:left-5 sm:top-5">0{index + 1}</span>
                <span className="absolute inset-x-0 bottom-0 p-4 sm:p-6"><span className="block text-[10px] uppercase tracking-[.2em] text-[#e7c991]">{product.fragrance_family || product.category}</span><span className="display-serif mt-1 block text-xl leading-tight sm:text-2xl">{product.name}</span><span className="mt-2 block text-xs text-white/70">From ₹{Number(product.price || 0).toLocaleString('en-IN')}</span></span>
              </button>)}
            </div>
          </div>
        </motion.section>}
        
        {/* Most Viewed Products */}
        {visibility.show_most_viewed && mostViewed.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.55 }} className="order-[20] mb-10 sm:mb-14">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Eye className="w-6 h-6 text-blue-600" />
                <h2 className="display-serif text-2xl sm:text-3xl font-semibold">Most Viewed</h2>
              </div>
              <Button variant="link" onClick={() => navigate('/customer/category/all')}>View All →</Button>
            </div>
            <div className="grid grid-cols-2 gap-3.5 sm:flex sm:gap-5 sm:overflow-x-auto sm:pb-4 no-scrollbar">
              {(Array.isArray(mostViewed) ? mostViewed : [])
                .slice(0, 6)
                .map((product) => (
                  <div key={product.id} className="min-w-0 sm:min-w-[205px] sm:max-w-[220px] sm:flex-shrink-0">
                  <ProductCard
                    product={product}
                    onClick={() => navigate(`/customer/product/${product.slug || product.id}`)}
                  />
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {creatorCampaigns.length > 0 && <section className="order-[50] mt-14 sm:mt-20" aria-labelledby="creator-campaigns-title">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#7d4956]">Seen on social</p>
              <h2 id="creator-campaigns-title" className="display-serif text-3xl font-semibold sm:text-4xl">Scent stories by creators</h2>
            </div>
            <p className="hidden text-sm text-stone-500 sm:block">Drag to discover · tap the heart to like</p>
          </div>
          <div className="-mx-3 flex snap-x snap-mandatory gap-4 overflow-x-auto px-3 pb-5 no-scrollbar sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8" tabIndex={0} aria-label="Creator advertisements">
            {creatorCampaigns.map(campaign => <CreatorCampaignCard key={campaign.id} campaign={campaign} visitorId={visitorId.current} onLike={toggleCampaignLike} />)}
          </div>
        </section>}

        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="order-[70] mb-12 sm:mb-16">
          <div className="text-center max-w-2xl mx-auto mb-7 sm:mb-9">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#8b5b66] mb-3">Find your fragrance family</p>
            <h2 className="display-serif text-3xl sm:text-4xl font-semibold">Begin with a feeling</h2>
            <p className="text-stone-500 mt-3 text-sm sm:text-base">Explore the notes you already love, then discover something unexpected.</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {scentFamilies.map((family, index) => (
              <button key={family.name} onClick={() => goToCategory(family.category)} className="group relative h-56 sm:h-72 overflow-hidden text-left">
                <img src={family.image} alt={family.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/10 to-transparent" />
                <span className="absolute top-4 right-4 grid place-items-center w-9 h-9 rounded-full bg-white/90 opacity-0 group-hover:opacity-100 transition-all"><ArrowUpRight className="w-4 h-4" /></span>
                <span className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <span className="block display-serif text-2xl sm:text-3xl">{family.name}</span>
                  <span className="block text-xs text-stone-200 mt-1">{family.note}</span>
                </span>
              </button>
            ))}
          </div>
        </motion.section>

        {/* Featured/Trending Products */}
        {visibility.show_trending && trending.length > 0 && (
          <section className="order-[30] mb-10 sm:mb-14">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-orange-500" />
                <h2 className="display-serif text-2xl sm:text-3xl font-semibold">Trending Now</h2>
              </div>
              <Button variant="link" onClick={() => setSelectedCategory(null)}>View All →</Button>
            </div>
            <div className="grid grid-cols-2 gap-3.5 sm:flex sm:gap-5 sm:overflow-x-auto sm:pb-4 no-scrollbar">
              {(Array.isArray(trending) ? trending : []).slice(0, 6).map((product) => (
                <div key={product.id} className="min-w-0 sm:min-w-[205px] sm:max-w-[220px] sm:flex-shrink-0">
                  <ProductCard product={product} onClick={() => navigate(`/customer/product/${product.slug || product.id}`)} />
                </div>
              ))}
            </div>
          </section>
        )}

        <motion.section initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="order-[60] mb-12 overflow-hidden bg-[#2b2422] p-5 text-white sm:mb-16 sm:p-8">
          <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.3em] text-[#d3aaa3]">The RAW edit</p><h2 className="display-serif mt-2 text-3xl sm:text-4xl">Stories selected by the house.</h2></div><p className="hidden max-w-sm text-right text-sm text-stone-400 sm:block">Ordered and updated from Hero &amp; Edit Management.</p></div>
          <div className="flex snap-x gap-4 overflow-x-auto pb-3 no-scrollbar">
            {offers.slice(0, 6).map((story, index) => <article key={`${story.title}-${index}`} className="group relative min-h-[360px] min-w-[88%] snap-start overflow-hidden text-left sm:min-w-[480px] lg:min-h-[420px] lg:min-w-[560px]">
              {story.media_type === 'video' ? <video src={story.image} className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline preload="metadata" /> : <img src={story.image} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />}
              <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8"><span className="block text-[10px] uppercase tracking-[.2em] text-[#e7c991]">Edit {String(index + 1).padStart(2, '0')}</span><h3 className="display-serif mt-1 text-3xl">{story.title}</h3><p className="mt-3 max-w-xl text-sm leading-6 text-white/75">{story.subtitle}</p><Button type="button" onClick={() => navigate(story.link)} className="mt-5 rounded-full bg-white px-6 text-stone-950 hover:bg-stone-100">{story.cta || 'Discover the edit'} <ArrowUpRight className="ml-2 h-4 w-4" /></Button></div>
            </article>)}
          </div>
        </motion.section>

        {visibility.show_bestsellers && bestsellers.length > 0 && (
          <section className="order-[40] mb-10 sm:mb-14">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-[#6f3b49]" />
                <h2 className="display-serif text-2xl sm:text-3xl font-semibold">Bestsellers</h2>
              </div>
              <Button variant="link" onClick={() => navigate('/customer/category/all')}>View All →</Button>
            </div>
            <div className="grid grid-cols-2 gap-3.5 sm:flex sm:gap-5 sm:overflow-x-auto sm:pb-4 no-scrollbar">
              {bestsellers.slice(0, 6).map((product) => (
                <div key={product.id} className="min-w-0 sm:min-w-[205px] sm:max-w-[220px] sm:flex-shrink-0">
                  <ProductCard product={product} onClick={() => navigate(`/customer/product/${product.slug || product.id}`)} />
                </div>
              ))}
            </div>
          </section>
        )}

        {visibility.show_offer_cards && (offerCards.length > 0 || activeCoupons.length > 0) && (
          <section id="offers-section" className="order-[80] mb-10 scroll-mt-28 sm:mb-14" aria-labelledby="offers-title">
            <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#7d4956]">Limited-time privileges</p>
                <h2 id="offers-title" className="display-serif text-2xl sm:text-3xl font-semibold">Offers for every guest</h2>
              </div>
              <p className="text-sm text-stone-500">{user ? 'Copy a code and apply it securely at checkout.' : 'Explore now, then sign in to redeem at checkout.'}</p>
            </div>
            {activeCoupons.length > 0 && (
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                {activeCoupons.slice(0, 4).map((coupon) => (
                  <article key={coupon.id} className="rounded-xl border border-[#6f3b49]/15 bg-gradient-to-br from-[#fffdf9] to-[#f4e9e7] p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Badge className="mb-3 bg-[#6f3b49] text-white">{coupon.discount_type === 'percentage' ? `${coupon.discount_value}% OFF` : `₹${coupon.discount_value} OFF`}</Badge>
                        <h3 className="display-serif text-xl font-semibold">{coupon.code === 'WELCOME10' ? 'A welcome from Perfurm' : 'Find your signature scent'}</h3>
                        <p className="mt-1 text-sm text-stone-600">Minimum order ₹{coupon.min_order_amount}{coupon.max_discount ? ` · Save up to ₹${coupon.max_discount}` : ''}</p>
                      </div>
                      <Gift className="h-7 w-7 shrink-0 text-[#7d4956]" />
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <div className="flex min-w-0 items-center overflow-hidden rounded-full border border-dashed border-[#6f3b49]/50 bg-white">
                        <span className="px-4 py-2 font-mono text-sm font-semibold tracking-wider">{coupon.code}</span>
                        <button type="button" onClick={() => copyOfferCode(coupon.code)} className="flex min-h-10 items-center gap-1.5 border-l border-[#6f3b49]/15 px-3 text-xs font-semibold text-[#6f3b49] transition-colors hover:bg-[#f4e9e7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6f3b49]" aria-label={`Copy offer code ${coupon.code}`}>
                          {copiedOfferCode === coupon.code ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          {copiedOfferCode === coupon.code ? 'Copied' : 'Copy code'}
                        </button>
                      </div>
                      <Button size="sm" className="rounded-full" onClick={() => navigate(user ? '/customer/category/all' : '/auth')}>{user ? 'Shop now' : 'Login to redeem'}</Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {offerCards.map((offer) => (
                <button key={offer.id} onClick={() => offer.link_url && navigate(offer.link_url)} className="relative min-h-36 overflow-hidden rounded-sm text-left bg-[#6f3b49] text-white p-6 group">
                  {offer.image_url && <img src={offer.image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-35 group-hover:scale-105 transition-transform duration-500" />}
                  <span className="relative block display-serif text-xl font-semibold">{offer.title}</span>
                  <span className="relative block text-sm text-stone-200 mt-2">{offer.description}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {visibility.show_bank_offers && bankOffers.length > 0 && (
          <section className="order-[90] mb-10 sm:mb-14 border-y border-stone-200 py-5">
            <div className="flex gap-4 overflow-x-auto no-scrollbar">
              {bankOffers.map((offer) => (
                <div key={offer.id} className="min-w-[260px] rounded-sm border border-stone-200 bg-[#fffdf9] px-5 py-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#8b6f68]">{offer.bank_name}</p>
                  <p className="font-medium mt-1">{offer.offer_text}</p>
                  {offer.min_order_amount > 0 && <p className="text-xs text-stone-500 mt-2">Minimum order ₹{offer.min_order_amount}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
        
        {/* All Products */}
        {visibility.show_new_arrivals && <section className="order-[100]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="display-serif text-2xl sm:text-3xl font-semibold">
              {selectedCategory || 'All Products'}
            </h2>
            <Button variant="link" onClick={() => navigate('/customer/category/all')}>View All →</Button>
          </div>
          
          {products.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5 lg:gap-6">
              {(Array.isArray(products) ? products : [] ).slice(0, 8).map((product) => (
                <div key={product.id}>
                <ProductCard
                  product={product}
                  onClick={() => navigate(`/customer/product/${product.slug || product.id}`)}
                />
               </div>
              ))}
            </div>
          )}
        </section>}

        <section className="order-[110] mt-14 sm:mt-20 mb-4 text-center">
          <Quote className="w-8 h-8 mx-auto text-[#a1727c] mb-5" />
          <blockquote className="display-serif text-2xl sm:text-4xl max-w-4xl mx-auto leading-snug">“The discovery set made choosing a signature scent feel personal, unhurried and genuinely special.”</blockquote>
          <div className="flex justify-center gap-1 mt-5 text-[#7d4956]">{[1,2,3,4,5].map((star) => <Star key={star} className="w-4 h-4 fill-current" />)}</div>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500 mt-3">Aarohi · Mumbai</p>
        </section>
        {topReviews.length > 0 && (
          <section className="order-[120] mt-14 sm:mt-20" aria-labelledby="top-reviews-title">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#7d4956]">Verified fragrance stories</p>
                <h2 id="top-reviews-title" className="display-serif text-3xl font-semibold sm:text-4xl">Top reviews</h2>
              </div>
              <span className="text-sm text-stone-500">{topReviews.length} customer reviews</span>
            </div>
            <article className="relative overflow-hidden rounded-2xl bg-[#2b2221] px-6 py-8 text-white sm:px-10 sm:py-10">
              <Quote className="absolute right-6 top-5 h-16 w-16 text-white/10" />
              <div className="relative max-w-4xl">
                <div className="mb-4 flex gap-1 text-[#e7b98d]">{Array.from({ length: topReviews[0].rating }).map((_, index) => <Star key={index} className="h-4 w-4 fill-current" />)}</div>
                <blockquote className="display-serif text-2xl leading-snug sm:text-4xl">“{topReviews[0].comment}”</blockquote>
                <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-300">
                  <span className="font-semibold text-white">{topReviews[0].customer_name}</span>
                  <span>Verified purchase</span>
                  {topReviews[0].product && <button type="button" className="underline decoration-white/30 underline-offset-4" onClick={() => navigate(`/customer/product/${topReviews[0].product.slug || topReviews[0].product.id}`)}>{topReviews[0].product.name}</button>}
                </div>
              </div>
            </article>
            <div
              className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 no-scrollbar sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3"
              tabIndex={0}
              aria-label="More verified customer reviews"
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') event.currentTarget.scrollBy({ left: 280, behavior: reduceMotion ? 'auto' : 'smooth' });
                if (event.key === 'ArrowLeft') event.currentTarget.scrollBy({ left: -280, behavior: reduceMotion ? 'auto' : 'smooth' });
              }}
            >
              {topReviews.slice(1).map((review) => (
                <article key={review.id} className="min-w-[82vw] snap-start rounded-xl border border-stone-200 bg-[#fffdf9] p-5 sm:min-w-0">
                  <div className="flex gap-0.5 text-[#9a5d69]">{Array.from({ length: review.rating }).map((_, index) => <Star key={index} className="h-3.5 w-3.5 fill-current" />)}</div>
                  <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-stone-700">“{review.comment}”</p>
                  <div className="mt-4 border-t border-stone-100 pt-3">
                    <p className="text-sm font-semibold">{review.customer_name}</p>
                    <p className="text-xs text-stone-500">Verified purchase{review.product ? ` · ${review.product.name}` : ''}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      {visibility.show_footer && <footer className="bg-[#211c1b] text-white mt-12">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <BrandMark inverse />
              </div>
              <p className="text-gray-400 text-sm">
                {footerContent?.about_text || 'Fine fragrance, thoughtfully discovered. Find a scent that feels unmistakably yours.'}
              </p>
              {/* Social Media Icons */}
              <div className="flex gap-4 mt-4">
                <a href={footerContent?.facebook_url || 'https://facebook.com'} aria-label="Perfurm on Facebook" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">
                  <Facebook className="w-5 h-5" />
                </a>
                <a href={footerContent?.instagram_url || 'https://instagram.com'} aria-label="Perfurm on Instagram" target="_blank" rel="noopener noreferrer" className="hover:text-pink-400 transition-colors">
                  <Instagram className="w-5 h-5" />
                </a>
                <a href={footerContent?.twitter_url || 'https://twitter.com'} aria-label="Perfurm on X" target="_blank" rel="noopener noreferrer" className="hover:text-blue-300 transition-colors">
                  <Twitter className="w-5 h-5" />
                </a>
                <a href={footerContent?.youtube_url || 'https://youtube.com'} aria-label="Perfurm on YouTube" target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors">
                  <Youtube className="w-5 h-5" />
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                {(footerContent?.quick_links || [{label:'About Us',url:'/customer/support'},{label:'Terms & Conditions',url:'/customer/support'},{label:'Privacy Policy',url:'/privacy-policy'},{label:'Cookie Policy',url:'/cookie-policy'},{label:'Return Policy',url:'/customer/support'}]).map(link => <li key={`${link.label}-${link.url}`}><Link to={link.url} className="hover:text-white transition-colors">{link.label}</Link></li>)}
              <li><button type="button" onClick={consent.openPreferences} className="hover:text-white transition-colors">Cookie preferences</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact Us</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <a href={`mailto:${footerContent?.contact_email || 'care@perfurm.com'}`} className="hover:text-white transition-colors flex items-center gap-2">
                    <Mail className="w-4 h-4" /> {footerContent?.contact_email || 'care@perfurm.com'}
                  </a>
                </li>
                <li>
                  <a href={`tel:${footerContent?.contact_phone || '+919999999999'}`} className="hover:text-white transition-colors flex items-center gap-2">
                    <Phone className="w-4 h-4" /> {footerContent?.contact_phone || '+91 99999 99999'}
                  </a>
                </li>
                <li className="text-gray-400">
                  {footerContent?.address || 'India'}
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Download App</h4>
              <p className="text-sm text-gray-400 mb-4">Get the best shopping experience</p>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start border-gray-600 text-white hover:bg-gray-800">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2" fill="currentColor"><path d="M17.523 2H6.477C5.1 2 4 3.1 4 4.477v15.046C4 20.9 5.1 22 6.477 22h11.046C18.9 22 20 20.9 20 19.523V4.477C20 3.1 18.9 2 17.523 2zM12 20c-.827 0-1.5-.673-1.5-1.5S11.173 17 12 17s1.5.673 1.5 1.5S12.827 20 12 20zm5-4H7V5h10v11z"/></svg>
                  App Store
                </Button>
                <Button variant="outline" className="w-full justify-start border-gray-600 text-white hover:bg-gray-800">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2" fill="currentColor"><path d="M3 20.5V3.5C3 2.91 3.34 2.39 3.84 2.15L13.69 12L3.84 21.85C3.34 21.6 3 21.09 3 20.5M16.81 15.12L6.05 21.34L14.54 12.85L16.81 15.12M20.16 10.81C20.5 11.08 20.75 11.5 20.75 12C20.75 12.5 20.53 12.9 20.18 13.18L17.89 14.5L15.39 12L17.89 9.5L20.16 10.81M6.05 2.66L16.81 8.88L14.54 11.15L6.05 2.66Z"/></svg>
                  Google Play
                </Button>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2026 RAW. All rights reserved.</p>
          </div>
        </div>
      </footer>}
      <Dialog open={offerPopupOpen} onOpenChange={(open) => open ? setOfferPopupOpen(true) : dismissOfferPopup()}>
        <DialogContent className="w-[calc(100%-1.5rem)] overflow-hidden border-0 bg-[#fffaf5] p-0 sm:max-w-xl">
          {popupCoupon && <div className="relative">
            <div className="bg-gradient-to-br from-[#5d2d3a] via-[#7d4956] to-[#b57b78] px-6 py-8 text-white sm:px-9 sm:py-10">
              <div className="absolute -right-10 -top-12 h-44 w-44 rounded-full border border-white/15"/><div className="absolute -right-3 top-5 h-24 w-24 rounded-full border border-white/15"/>
              <Badge className="mb-4 bg-white/15 text-white hover:bg-white/15">Limited-time Perfurm privilege</Badge>
              <DialogHeader className="relative text-left"><DialogTitle className="display-serif text-3xl leading-tight text-white sm:text-4xl">A little luxury, on us.</DialogTitle><DialogDescription className="mt-2 text-sm text-white/80 sm:text-base">{popupCoupon.discount_type === 'percentage' ? `Enjoy ${popupCoupon.discount_value}% off` : `Save ₹${popupCoupon.discount_value}`} on your next fragrance discovery{popupCoupon.min_order_amount ? ` above ₹${popupCoupon.min_order_amount}` : ''}.</DialogDescription></DialogHeader>
            </div>
            <div className="space-y-4 px-6 py-6 sm:px-9">
              <div className="flex items-center justify-between rounded-xl border border-dashed border-[#7d4956]/35 bg-white p-2 pl-4"><div><p className="text-[10px] uppercase tracking-[.18em] text-stone-500">Your offer code</p><p className="font-mono text-lg font-bold tracking-wider text-[#5d2d3a]">{popupCoupon.code}</p></div><Button variant="ghost" onClick={()=>copyOfferCode(popupCoupon.code)}>{copiedOfferCode===popupCoupon.code?<Check className="mr-2 h-4 w-4"/>:<Copy className="mr-2 h-4 w-4"/>}{copiedOfferCode===popupCoupon.code?'Copied':'Copy'}</Button></div>
              <div className="grid gap-2 sm:grid-cols-2"><Button className="rounded-full bg-[#6f3b49] hover:bg-[#5d2d3a]" onClick={()=>{dismissOfferPopup();navigate(user?'/customer/category/all':'/auth');}}>{user?'Shop this offer':'Login to redeem'}</Button><Button variant="outline" className="rounded-full" onClick={()=>{dismissOfferPopup();navigate('/customer/offers');}}>View all offers</Button></div>
              <button type="button" onClick={dismissOfferPopup} className="w-full text-center text-xs text-stone-500 underline-offset-4 hover:underline">Maybe later</button>
            </div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SearchResultsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const query = searchParams.get('q') || '';

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API_URL}/search`, { params: { q: query } });
        setProducts(response.data);
      } catch (error) {
        console.error('Error searching:', error);
      }
      setLoading(false);
    };
    
    if (query) {
      fetchResults();
    } else {
      setLoading(false);
      setProducts([]);
    }
  }, [query]);

  if (loading) {
    return <div className="min-h-screen perfurm-page"><BottleLoader label="Finding your next signature" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ChevronLeft />
            </Button>
            <div className="flex-1">
              <SearchBar />
            </div>
          </div>
        </div>
      </header>
      
      <div className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 py-6">
        <h1 className="display-serif text-2xl font-semibold mb-4">
          {query ? `Search results for “${query}” (${products.length} items)` : 'What are you looking for?'}
        </h1>
        
        {!query ? (
          <div className="rounded-2xl border border-stone-200 bg-[#fffdf9] px-5 py-10 text-center">
            <Search className="mx-auto mb-4 h-10 w-10 text-[#7d4956]" />
            <p className="font-medium text-stone-800">Search by perfume, fragrance note or house</p>
            <p className="mt-1 text-sm text-stone-500">Try “oud”, “rose”, “fresh” or “discovery set”.</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No products found matching "{query}"</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => navigate(`/customer/product/${product.slug || product.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OffersPage() {
  const [data, setData] = useState({ coupons: [], cards: [], banks: [] });
  const [copied, setCopied] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    Promise.all([axios.get(`${API_URL}${user ? '/coupons/mine' : '/coupons/active'}`), axios.get(`${API_URL}/offer-cards`), axios.get(`${API_URL}/bank-offers`)])
      .then(([coupons, cards, banks]) => setData({ coupons: coupons.data || [], cards: cards.data || [], banks: banks.data || [] }))
      .catch(() => toast.error('Offers could not be loaded'))
      .finally(() => setLoading(false));
  }, [user]);
  const copyCode = async code => {
    try { await navigator.clipboard.writeText(code); setCopied(code); toast.success(`${code} copied`); window.setTimeout(() => setCopied(''), 1800); }
    catch { toast.error('Could not copy this code'); }
  };
  if (loading) return <div className="min-h-screen perfurm-page"><BottleLoader label="Preparing your offers" /></div>;
  return <div className="min-h-screen bg-[#f8f5f1]">
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-[#fffdf9]/95 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-3 sm:px-6"><Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Go back"><ChevronLeft /></Button><div><p className="text-[10px] uppercase tracking-[0.2em] text-[#7d4956]">RAW privileges</p><h1 className="display-serif text-2xl font-semibold">Offers</h1></div></div></header>
    <main className="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-10">
      <section className="mb-8 overflow-hidden rounded-2xl bg-[#5c3340] px-6 py-8 text-white sm:px-10"><p className="text-xs uppercase tracking-[0.18em] text-white/65">Made for your next discovery</p><h2 className="display-serif mt-2 text-3xl sm:text-5xl">A little more reason to linger.</h2><p className="mt-3 max-w-2xl text-sm text-white/75">Copy an available code and apply it securely during checkout.</p></section>
      <section aria-labelledby="coupon-page-title"><h2 id="coupon-page-title" className="display-serif mb-4 text-2xl font-semibold">Coupon codes</h2><div className="grid gap-4 md:grid-cols-2">{data.coupons.map(coupon => <article key={coupon.id} className="rounded-2xl border border-[#6f3b49]/15 bg-white p-5 shadow-sm"><div className="flex justify-between gap-3"><div><Badge className="bg-[#6f3b49]">{coupon.discount_type === 'percentage' ? `${coupon.discount_value}% OFF` : `₹${coupon.discount_value} OFF`}</Badge><h3 className="display-serif mt-3 text-xl font-semibold">{coupon.code === 'WELCOME10' ? 'Your Perfurm welcome' : 'A signature-scent saving'}</h3><p className="mt-1 text-sm text-stone-500">Minimum order ₹{coupon.min_order_amount}{coupon.max_discount ? ` · up to ₹${coupon.max_discount}` : ''}</p></div><Gift className="h-7 w-7 text-[#7d4956]" /></div><div className="mt-5 flex flex-wrap gap-2"><Button variant="outline" className="rounded-full border-dashed font-mono" onClick={() => copyCode(coupon.code)}>{copied === coupon.code ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}{copied === coupon.code ? 'Copied' : coupon.code}</Button><Button className="rounded-full" onClick={() => navigate(user ? '/customer/category/all' : '/auth')}>{user ? 'Shop offer' : 'Login to redeem'}</Button></div></article>)}</div></section>
      {data.cards.length > 0 && <section className="mt-10"><h2 className="display-serif mb-4 text-2xl font-semibold">Featured privileges</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.cards.map(offer => <button key={offer.id} onClick={() => offer.link_url && navigate(offer.link_url)} className="relative min-h-44 overflow-hidden rounded-2xl bg-[#6f3b49] p-6 text-left text-white">{offer.image_url && <img src={offer.image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />}<span className="relative display-serif block text-xl font-semibold">{offer.title}</span><span className="relative mt-2 block text-sm text-white/75">{offer.description}</span></button>)}</div></section>}
      {data.banks.length > 0 && <section className="mt-10"><h2 className="display-serif mb-4 text-2xl font-semibold">Payment offers</h2><div className="flex snap-x gap-3 overflow-x-auto pb-4">{data.banks.map(offer => <article key={offer.id} className="min-w-[270px] snap-start rounded-xl border bg-white p-5"><p className="text-xs uppercase tracking-wider text-[#7d4956]">{offer.bank_name}</p><p className="mt-2 font-medium">{offer.offer_text}</p>{offer.min_order_amount > 0 && <p className="mt-2 text-xs text-stone-500">Minimum ₹{offer.min_order_amount}</p>}</article>)}</div></section>}
    </main>
  </div>;
}

function MobileShopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const items = [
    { label: 'Home', icon: Home, path: '/' },
    { label: 'Search', icon: Search, path: '/customer/search' },
    { label: 'Offers', icon: Percent, path: '/customer/offers' },
    { label: 'Wishlist', icon: Heart, path: '/customer/wishlist' },
    { label: user ? 'Account' : 'Login', icon: User, path: user ? '/customer/profile' : '/auth' },
  ];

  const open = (item) => navigate(item.path);

  return (
    <nav aria-label="Mobile shopping" className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-[#fffdf9]/95 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_30px_rgba(55,40,35,0.10)] backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path.split('?')[0]);
          return <button key={item.label} type="button" onClick={() => open(item)} className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium ${active ? 'text-[#6f3b49]' : 'text-stone-500'}`} aria-current={active ? 'page' : undefined}>
            <Icon className={`h-5 w-5 ${active ? 'stroke-[2.4]' : ''}`} />
            <span>{item.label}</span>
          </button>;
        })}
      </div>
    </nav>
  );
}

function CreatorCampaignCard({ campaign, visitorId, onLike }) {
  const consent = useConsent();
  const cardRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const tracked = useRef(false);
  useEffect(() => {
    if (!consent.hasConsent('analytics') || !visitorId) return undefined;
    const node = cardRef.current;
    if (!node || tracked.current) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.55 && !tracked.current) {
        tracked.current = true;
        axios.post(`${API_URL}/creator-campaigns/${campaign.id}/events`, { visitor_id: visitorId, event_type: 'view', source: campaign.social_channel, referrer: document.referrer || null }).catch(() => {});
        observer.disconnect();
      }
    }, { threshold: 0.55 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [campaign, visitorId, consent.preferences?.analytics]);

  const openCampaign = () => {
    if (consent.hasConsent('analytics') && visitorId) axios.post(`${API_URL}/creator-campaigns/${campaign.id}/events`, { visitor_id: visitorId, event_type: 'click', source: campaign.social_channel, referrer: document.referrer || null }).catch(() => {});
    if (campaign.destination_url) window.open(campaign.destination_url, '_blank', 'noopener,noreferrer');
  };

  return <article ref={cardRef} className="relative w-[78vw] max-w-[330px] shrink-0 snap-start overflow-hidden rounded-2xl bg-stone-950 text-white shadow-lg">
    <button type="button" onClick={openCampaign} className="block w-full text-left" aria-label={`View ${campaign.title}`}>
      {campaign.media_type === 'video' && !consent.hasConsent('marketing') ? <div className="flex aspect-[4/5] items-center justify-center bg-stone-900 p-6 text-center text-sm text-stone-200"><button className="underline" type="button" onClick={consent.openPreferences}>Allow marketing media to play this campaign</button></div> : campaign.media_type === 'video' ?
        <video className="aspect-[4/5] w-full object-cover" src={campaign.media_url} poster={campaign.thumbnail_url || undefined} muted={muted} autoPlay loop playsInline preload="metadata" /> :
        <img className="aspect-[4/5] w-full object-cover" src={campaign.media_url} alt={`${campaign.creator_name} campaign`} loading="lazy" />}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-4 pt-16">
        <p className="text-[11px] uppercase tracking-[0.16em] text-white/70">{campaign.social_channel} · {campaign.creator_name}</p>
        <h3 className="mt-1 text-lg font-semibold">{campaign.title}</h3>
        {campaign.caption && <p className="mt-1 line-clamp-2 text-sm text-white/75">{campaign.caption}</p>}
      </div>
    </button>
    {campaign.media_type === 'video' && <button type="button" onClick={() => setMuted(value => !value)} className="absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur-md" aria-label={muted ? 'Unmute advertisement' : 'Mute advertisement'}>{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>}
    <button type="button" onClick={() => onLike(campaign)} className={`absolute right-3 top-3 flex min-h-10 items-center gap-1.5 rounded-full px-3 backdrop-blur-md ${campaign.liked_by_visitor ? 'bg-[#6f3b49] text-white' : 'bg-black/45 text-white'}`} aria-label={campaign.liked_by_visitor ? 'Unlike advertisement' : 'Like advertisement'}>
      <Heart className={`h-4 w-4 ${campaign.liked_by_visitor ? 'fill-current' : ''}`} /><span className="text-xs font-semibold">{campaign.likes || 0}</span>
    </button>
  </article>;
}

export default function CustomerPortal() {
  return (
    <div className="pb-16 md:pb-0">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchResultsPage />} />
        <Route path="/offers" element={<OffersPage />} />
        <Route path="/category/:category" element={<CategoryPage />} />
        <Route path="/product/:id" element={<ProductDetails />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/orders" element={<MyOrders />} />
        <Route path="/orders/:orderId/track" element={<OrderTracking />} />
        <Route path="/orders/:orderId/return" element={<ReturnRequest />} />
        <Route path="/support" element={<SupportCenter />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/enhanced" element={<EnhancedProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      <MobileShopNav />
    </div>
  );
}
